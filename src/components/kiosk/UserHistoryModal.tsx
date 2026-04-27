import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Loader2, AlertCircle, Clock, Calendar, ChevronLeft, Receipt, ChevronRight } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import * as api from '../../api';

interface UserHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export const UserHistoryModal: React.FC<UserHistoryModalProps> = ({
  isOpen,
  onClose,
  t,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfidInput, setRfidInput] = useState('');
  const [view, setView] = useState<'selection' | 'last_order' | 'history'>('selection');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the hidden input when modal opens
  useEffect(() => {
    if (isOpen) {
      setProfile(null);
      setError(null);
      setRfidInput('');
      setView('selection');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleScan = async (rawValue: string) => {
    const rfid = rawValue.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    if (!rfid || rfid.length < 4) return;

    setLoading(true);
    setError(null);
    setProfile(null);
    setRfidInput('');
    setView('selection');

    try {
      const data = await api.fetchCardProfile(rfid);
      setProfile(data);
    } catch {
      setError(t('kiosk.card_not_found'));
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyOrders = (orders: Order[]) => {
    if (!Array.isArray(orders)) return [];
    const now = new Date();
    return orders.filter(order => {
      const d = new Date(order.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const renderSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <button
        onClick={() => setView('last_order')}
        className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-white transition-all hover:scale-[1.02] active:scale-95 shadow-xl hover:shadow-indigo-500/10"
      >
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
          <Receipt className="w-8 h-8" />
        </div>
        <div className="text-center">
          <span className="block text-lg font-black uppercase tracking-tight">
            {t('kiosk.detailed_last_order')}
          </span>
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
            {t('kiosk.detailed_order_title')}
          </span>
        </div>
      </button>

      <button
        onClick={() => setView('history')}
        className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-white border border-neutral-200 rounded-3xl text-neutral-900 transition-all hover:scale-[1.02] active:scale-95 shadow-xl hover:shadow-black/5"
      >
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
          <Calendar className="w-8 h-8 text-neutral-600 group-hover:text-indigo-600" />
        </div>
        <div className="text-center">
          <span className="block text-lg font-black uppercase tracking-tight">
            {t('kiosk.monthly_history')}
          </span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
            {t('kiosk.monthly_history_title')}
          </span>
        </div>
      </button>
    </div>
  );

  const renderLastOrder = (order: Order) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Receipt className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              {t('orders.total')}
            </p>
            <p className="text-2xl font-black text-neutral-900">
              €{(Number(order.totalPrice) || 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            {t('orders.timestamp')}
          </p>
          <p className="text-xs font-bold text-neutral-900 mt-1">
            {new Date(order.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-neutral-400 ml-1">
          {t('orders.items')}
        </p>
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          {order.items.map((item, idx) => (
            <div 
              key={`${item.id}-${idx}`}
              className={`flex items-start justify-between p-4 ${idx !== order.items.length - 1 ? 'border-b border-neutral-100' : ''}`}
            >
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-900">{item.name}</p>
                {item.side && (
                  <p className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5" />
                    {item.side}
                  </p>
                )}
              </div>
              <p className="text-sm font-mono font-bold text-neutral-500">
                €{(Number(item.price) || 0).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHistory = (orders: Order[]) => {
    const monthly = getMonthlyOrders(orders);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-neutral-400 ml-1">
            {t('kiosk.monthly_history_title')}
          </p>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
            {monthly.length} {t('menu.items')}
          </span>
        </div>
        
        {monthly.length > 0 ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-4">
            {monthly.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-4 px-6 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <Clock className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">
                      {new Date(order.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5 max-w-[200px] truncate">
                      {order.items.map(i => i.name).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-black text-neutral-900">
                    €{(Number(order.totalPrice) || 0).toFixed(2)}
                  </p>
                  <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-tighter">
                    {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
            <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-400 italic">
              {t('orders.no_orders')}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-neutral-900 text-white px-8 py-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter leading-tight">
                    {t('kiosk.user_history_title')}
                  </h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold mt-1">
                    {t('kiosk.user_history_subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-colors"
                aria-label={t('modals.close')}
                title={t('modals.close')}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              {/* RFID Input Area - always present if no profile */}
              {!profile && (
                <div className="mb-8">
                  <div
                    className={`flex items-center gap-4 px-6 py-5 rounded-3xl border-2 transition-all ${
                      loading
                        ? 'border-neutral-300 bg-neutral-50'
                        : 'border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-400'
                    }`}
                    onClick={() => inputRef.current?.focus()}
                  >
                    <CreditCard
                      className={`w-6 h-6 shrink-0 ${loading ? 'animate-pulse text-indigo-500' : 'text-neutral-400'}`}
                    />
                    <input
                      ref={inputRef}
                      value={rfidInput}
                      onChange={(e) => setRfidInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScan(e.currentTarget.value);
                        }
                      }}
                      placeholder={t('kiosk.user_history_scan_prompt')}
                      className="flex-1 bg-transparent border-none focus:outline-none font-mono text-sm text-neutral-700 placeholder:text-neutral-400"
                      autoComplete="off"
                    />
                    {loading && <Loader2 className="w-5 h-5 animate-spin text-neutral-400 shrink-0" />}
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-4 p-5 bg-red-50 border border-red-200 rounded-3xl mb-8 text-red-700 shadow-sm shadow-red-500/5"
                >
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </motion.div>
              )}

              {/* Profile Context Header - always present if profile exists */}
              {profile && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 mb-8 shadow-xl shadow-black/10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                        {t('cards.owner_name')}
                      </p>
                      <h3 className="text-2xl font-black text-white">{profile.ownerName}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-mono bg-white/10 text-neutral-400 px-2 py-0.5 rounded-lg border border-white/5">
                          {profile.rfid}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 mb-1">
                        {t('cards.owed')}
                      </p>
                      <span
                        className={`text-4xl font-black font-mono tracking-tighter ${
                          Number(profile.balance) > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        €{(Number(profile.balance) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view Rendering */}
              {profile && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {view !== 'selection' && (
                      <button
                        onClick={() => setView('selection')}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm mb-6 w-fit px-4 py-2 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('kiosk.back')}
                      </button>
                    )}

                    {view === 'selection' && renderSelection()}
                    {view === 'last_order' && profile.orders[0] && renderLastOrder(profile.orders[0])}
                    {view === 'history' && renderHistory(profile.orders)}
                    
                    {view === 'last_order' && !profile.orders[0] && (
                       <p className="text-center text-sm text-neutral-400 italic py-12">
                         {t('orders.no_orders')}
                       </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Initial prompt */}
              {!loading && !profile && !error && (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-neutral-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-sm border border-neutral-100">
                    <CreditCard className="w-10 h-10 text-neutral-300" />
                  </div>
                  <h4 className="text-lg font-black text-neutral-900 mb-2">
                    {t('kiosk.user_history_scan_prompt')}
                  </h4>
                  <p className="text-neutral-400 text-sm max-w-xs mx-auto">
                    {t('kiosk.user_history_subtitle')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
