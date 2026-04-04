/**
 * UserHistoryModal — Feature 3: User history and balance screen.
 * Simplified to use centralized RFID flow from KioskView.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Loader2, AlertCircle, Clock } from 'lucide-react';
import { UserProfile } from '../../types';
import * as api from '../../api';

interface UserHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedRfid?: string; // Feature 3: Passed from KioskView on scan
  t: (key: string) => string;
}

export const UserHistoryModal: React.FC<UserHistoryModalProps> = ({
  isOpen,
  onClose,
  scannedRfid,
  t,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear or load based on rfid
  useEffect(() => {
    if (!isOpen) return;
    if (scannedRfid) {
      handleLoadProfile(scannedRfid);
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isOpen, scannedRfid]);

  const handleLoadProfile = async (rfid: string) => {
    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const data = await api.fetchCardProfile(rfid);
      setProfile(data);
    } catch {
      setError(t('kiosk.card_not_found'));
    } finally {
      setLoading(false);
    }
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
            className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-neutral-900 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter">
                    {t('kiosk.user_history_title')}
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {t('kiosk.user_history_subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              {/* Load state indicator */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                   <Loader2 className="w-10 h-10 animate-spin text-neutral-300 mb-4" />
                   <p className="text-neutral-400 text-sm font-medium italic">{t('navigation.network_error') || 'Loading profile...'}</p>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl mb-6 text-red-700"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}

              {/* Profile result */}
              {profile && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* Identity + balance card */}
                  <div className="bg-neutral-900 text-white rounded-2xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
                          {t('cards.owner_name')}
                        </p>
                        <h3 className="text-xl font-black">{profile.ownerName}</h3>
                        <p className="text-[10px] font-mono text-neutral-500 mt-1">
                          {profile.rfid}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
                          {t('cards.owed')}
                        </p>
                        <span
                          className={`text-3xl font-black font-mono ${
                            Number(profile.balance) > 0 ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          €{(Number(profile.balance) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent orders */}
                  {Array.isArray(profile.recentOrders) && profile.recentOrders.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-neutral-400 mb-3">
                        {t('kiosk.recent_orders')}
                      </p>
                      <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {profile.recentOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between py-3 px-4 bg-neutral-50 rounded-xl border border-neutral-100"
                          >
                            <div className="flex items-center gap-3">
                              <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-neutral-900">
                                  {new Date(order.timestamp).toLocaleDateString()}
                                </p>
                                <p className="text-[10px] text-neutral-400 mt-0.5 truncate max-w-[200px]">
                                  {Array.isArray(order.items)
                                    ? order.items.map((i) => i.name).join(', ')
                                    : '—'}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono font-black text-sm text-neutral-900 ml-4 shrink-0">
                              €{(Number(order.totalPrice) || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-neutral-400 italic py-4">
                      {t('orders.no_orders')}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Initial prompt */}
              {!loading && !profile && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-neutral-500 text-sm font-medium">
                    {t('kiosk.user_history_scan_prompt')}
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
