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
import { MenuItem, Order, AppState, Card } from './types';

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
  
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws.current = new WebSocket(`${protocol}//${host}`);

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'INITIAL_STATE':
          setMenu(message.menu);
          setOrders(message.orders);
          setKioskOpen(message.kioskOpen);
          setCards(message.cards || []);
          break;
        case 'MENU_UPDATE':
          setMenu(message.data);
          break;
        case 'CARDS_UPDATE':
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

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const handleOrder = async () => {
    if (!rfid || selectedItems.length === 0) return;

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid, itemIds: selectedItems.map(i => i.id) }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setSelectedItems([]);
        setRfid('');
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Order failed. Please try again.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setTimeout(() => setError(null), 3000);
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

  const updateCards = async (newCards: Card[]) => {
    try {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCards),
      });
    } catch (err) {
      console.error('Failed to update cards', err);
    }
  };

  const KioskView = () => {
    const groupedMenu = menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

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
                      whileTap={{ backgroundColor: "#f3f4f6" }}
                      onClick={() => toggleItem(item)}
                      className={`cursor-pointer group flex justify-between items-center px-3 py-1.5 transition-all duration-75 ${
                        selectedItems.find(i => i.id === item.id) 
                          ? 'bg-neutral-900 text-white' 
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className={`text-[13px] font-medium block truncate ${selectedItems.find(i => i.id === item.id) ? 'text-white' : 'text-neutral-700'}`}>
                          {item.name}
                        </span>
                      </div>
                      <div className="shrink-0">
                        <span className={`text-[11px] font-bold font-mono ${selectedItems.find(i => i.id === item.id) ? 'text-white' : 'text-neutral-900'}`}>
                          {item.price.toFixed(2)}
                        </span>
                      </div>
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
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-0.5">
                    {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected • €{totalPrice.toFixed(2)}
                  </p>
                  <h4 className="text-lg font-bold text-neutral-900 truncate">
                    {selectedItems.map(i => i.name).join(', ')}
                  </h4>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedItems([])}
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="relative flex-1 md:w-40">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Scan Card"
                      value={rfid}
                      onChange={(e) => setRfid(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2 bg-neutral-100 rounded-xl border-none focus:ring-1 transition-all font-mono text-sm ${
                        rfid && !cards.find(c => c.rfid === rfid) 
                          ? 'ring-1 ring-red-500 bg-red-50' 
                          : 'focus:ring-neutral-900'
                      }`}
                      autoFocus
                    />
                    {rfid && !cards.find(c => c.rfid === rfid) && (
                      <motion.p 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-6 left-0 text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200 shadow-sm whitespace-nowrap"
                      >
                        Unregistered Card
                      </motion.p>
                    )}
                    {cards.find(c => c.rfid === rfid) && (
                      <motion.p 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-6 left-0 text-[10px] font-bold text-neutral-900 bg-white px-2 py-0.5 rounded-full border border-neutral-200 shadow-sm whitespace-nowrap"
                      >
                        Owner: {cards.find(c => c.rfid === rfid)?.ownerName}
                      </motion.p>
                    )}
                  </div>
                  <button
                    onClick={handleOrder}
                    disabled={!rfid || !cards.find(c => c.rfid === rfid)}
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
};

  const ManagerView = () => {
    const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'cards'>('menu');
    const [editingMenu, setEditingMenu] = useState<MenuItem[]>(menu);
    const [pasteText, setPasteText] = useState('');
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    
    const [pasteCardsText, setPasteCardsText] = useState('');
    const [isPasteCardsModalOpen, setIsPasteCardsModalOpen] = useState(false);
    const [newCardRfid, setNewCardRfid] = useState('');
    const [newCardOwner, setNewCardOwner] = useState('');

    // Aggregate orders
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

    const handlePasteMenu = () => {
      const lines = pasteText.split('\n');
      const newItems: MenuItem[] = [];
      let currentId = Date.now();
      let currentCategory = "General";

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // Detect potential categories (lines without prices but with text)
        const priceMatch = trimmedLine.match(/(\d+(?:\.\d+)?)€/);
        
        if (!priceMatch && trimmedLine.length > 3 && !trimmedLine.startsWith('-')) {
          // Likely a category header
          currentCategory = trimmedLine.replace(/:$/, '').trim();
          return;
        }

        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          let name = trimmedLine.split(priceMatch[0])[0].trim();
          
          // Clean up the name
          name = name.replace(/^-/, '').trim();
          
          if (name && !isNaN(price)) {
            newItems.push({
              id: currentId++,
              name,
              description: "",
              price,
              available: true,
              category: currentCategory
            });
          }
        }
      });

      if (newItems.length > 0) {
        const updated = newItems;
        setEditingMenu(updated);
        updateMenu(updated);
        setPasteText('');
        setIsPasteModalOpen(false);
      }
    };

    const handlePasteCards = () => {
      const lines = pasteCardsText.split('\n');
      const newCards: Card[] = [];

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // Expecting "RFID Name" or "RFID, Name" or "RFID - Name"
        const parts = trimmedLine.split(/[\s,\t\-]+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const rfid = parts[0];
          const ownerName = parts.slice(1).join(' ');
          newCards.push({ rfid, ownerName });
        }
      });

      if (newCards.length > 0) {
        // Merge with existing or replace? User said "import list", usually implies adding to or replacing.
        // Let's replace for now to keep it clean, or merge. 
        // "remove previous menu entries" was for menu. For cards, maybe merge is better?
        // Actually, let's just replace to follow the menu pattern unless specified.
        const updated = [...cards, ...newCards];
        // Remove duplicates by RFID
        const uniqueCards = Array.from(new Map(updated.map(c => [c.rfid, c])).values());
        updateCards(uniqueCards);
        setPasteCardsText('');
        setIsPasteCardsModalOpen(false);
      }
    };

    const addManualCard = () => {
      if (!newCardRfid || !newCardOwner) return;
      const updated = [...cards, { rfid: newCardRfid, ownerName: newCardOwner }];
      const uniqueCards = Array.from(new Map(updated.map(c => [c.rfid, c])).values());
      updateCards(uniqueCards);
      setNewCardRfid('');
      setNewCardOwner('');
    };

    const removeCard = (rfidToRemove: string) => {
      const updated = cards.filter(c => c.rfid !== rfidToRemove);
      updateCards(updated);
    };

    const removeItem = (id: number) => {
      const updated = editingMenu.filter(item => item.id !== id);
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

    const resetOrders = async () => {
      if (!window.confirm("Are you sure you want to clear all orders? This cannot be undone.")) return;
      try {
        await fetch('/api/orders/reset', { method: 'POST' });
      } catch (err) {
        console.error('Failed to reset orders', err);
      }
    };

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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'menu' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Utensils className="w-5 h-5" /> Menu Management
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'orders' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              <Clock className="w-5 h-5" /> Order Summary
            </button>
            <button 
              onClick={() => setActiveTab('cards')}
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
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${kioskOpen ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
              >
                {kioskOpen ? 'Close Kiosk' : 'Open Kiosk'}
              </button>
            </div>
          </div>

          <button 
            onClick={() => setView('kiosk')}
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
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                    >
                      <Plus className="w-5 h-5" /> Paste Menu
                    </button>
                    <button 
                      onClick={addItem}
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
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Order Summary</h1>
                    <p className="text-neutral-500">Aggregated data for today's orders</p>
                  </div>
                  <div className="flex gap-8 items-end">
                    <div className="text-right">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Total Items</p>
                      <p className="text-2xl font-black text-neutral-900">{totalItemsSold}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Total Revenue</p>
                      <p className="text-2xl font-black text-neutral-900">€{(totalRevenue as number).toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={resetOrders}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-200 transition-all"
                    >
                      Reset Orders
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-bottom border-neutral-100">
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400">Item</th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-center">Qty</th>
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {(Object.entries(aggregatedOrders) as [string, AggregatedItem][])
                            .sort((a, b) => b[1].count - a[1].count)
                            .map(([id, data]) => (
                            <tr key={id} className="hover:bg-neutral-50 transition-colors">
                              <td className="p-6">
                                <p className="font-bold text-neutral-900">{data.name}</p>
                                <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{data.category}</p>
                              </td>
                              <td className="p-6 text-center">
                                <span className="px-3 py-1 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900">
                                  {data.count}
                                </span>
                              </td>
                              <td className="p-6 text-right font-mono font-bold text-neutral-900">
                                €{data.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          {Object.keys(aggregatedOrders).length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-12 text-center text-neutral-400 italic">
                                No orders placed yet today.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-neutral-900">Recent Activity</h2>
                    <div className="space-y-4">
                      {orders.slice(0, 10).map((order) => (
                        <div key={order.id} className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-neutral-400">{new Date(order.timestamp).toLocaleTimeString()}</span>
                              {order.ownerName && (
                                <span className="text-xs font-black text-neutral-900 mt-0.5">{order.ownerName}</span>
                              )}
                            </div>
                            <span className="px-2 py-0.5 bg-neutral-900 text-white text-[8px] font-bold uppercase rounded-full">{order.status}</span>
                          </div>
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <p key={idx} className="text-xs font-bold text-neutral-800">• {item.name}</p>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-neutral-400 font-mono">RFID: {order.rfid}</p>
                        </div>
                      ))}
                      {orders.length === 0 && (
                        <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-neutral-400 italic text-sm">
                          Waiting for orders...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h1 className="text-4xl font-bold text-neutral-900 mb-2">Card Management</h1>
                    <p className="text-neutral-500">Manage RFID cards and owner names</p>
                  </div>
                  <div className="flex gap-4">
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
                            <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {cards.map((card) => (
                            <tr key={card.rfid} className="hover:bg-neutral-50 transition-colors">
                              <td className="p-6 font-mono text-sm text-neutral-600">{card.rfid}</td>
                              <td className="p-6 font-bold text-neutral-900">{card.ownerName}</td>
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
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">RFID Number</label>
                          <input 
                            type="text"
                            value={newCardRfid}
                            onChange={(e) => setNewCardRfid(e.target.value)}
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
                            placeholder="e.g. John Doe"
                            className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm"
                          />
                        </div>
                        <button 
                          onClick={addManualCard}
                          disabled={!newCardRfid || !newCardOwner}
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

  return view === 'kiosk' ? <KioskView /> : <ManagerView />;
};

export default App;
