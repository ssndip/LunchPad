import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, CreditCard, RotateCcw } from 'lucide-react';
import { Card } from '../../../types';

interface CardsTabProps {
  cards: Card[];
  onUpdateCards: (cards: Card[]) => void;
  onRemoveCard: (rfid: string) => void;
  onResetCardBalance: (rfid: string) => void;
  onResetAllBalances: () => void;
  onAddManualCard: () => void;
  onBatchAddCards: () => void;
  // New card form
  newCardRfid: string;
  setNewCardRfid: (v: string) => void;
  newCardOwner: string;
  setNewCardOwner: (v: string) => void;
  newCardIsAdmin: boolean;
  setNewCardIsAdmin: (v: boolean) => void;
  lastScanned: string | null;
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  // Paste modal
  pasteCardsText: string;
  setPasteCardsText: (v: string) => void;
  isPasteCardsModalOpen: boolean;
  setIsPasteCardsModalOpen: (v: boolean) => void;
  t: (key: string) => string;
}

export const CardsTab: React.FC<CardsTabProps> = ({
  cards,
  onUpdateCards,
  onRemoveCard,
  onResetCardBalance,
  onResetAllBalances,
  onAddManualCard,
  onBatchAddCards,
  newCardRfid,
  setNewCardRfid,
  newCardOwner,
  setNewCardOwner,
  newCardIsAdmin,
  setNewCardIsAdmin,
  lastScanned,
  isScanning,
  setIsScanning,
  pasteCardsText,
  setPasteCardsText,
  isPasteCardsModalOpen,
  setIsPasteCardsModalOpen,
  t,
}) => {
  const managerRfidRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.card_management')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">{t('cards.management_desc')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onResetAllBalances}
            tabIndex={-1}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all text-sm"
          >
            <Trash2 className="w-4 h-4" /> {t('cards.reset_monthly_balances')}
          </button>
          <button
            onClick={() => setIsPasteCardsModalOpen(true)}
            tabIndex={-1}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-sm"
          >
            <Plus className="w-4 h-4" /> {t('cards.import_cards')}
          </button>
        </div>
      </div>

      {/* Paste Cards Modal */}
      <AnimatePresence>
        {isPasteCardsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-2xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-2">{t('cards.import_cards')}</h2>
              <p className="text-neutral-500 mb-6 text-sm">{t('cards.import_instructions')}</p>
              <textarea
                value={pasteCardsText}
                onChange={(e) => setPasteCardsText(e.target.value)}
                placeholder={t('cards.import_placeholder')}
                className="w-full h-52 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm mb-6 focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-4">
                <button onClick={() => setIsPasteCardsModalOpen(false)} className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all">
                  {t('modals.cancel')}
                </button>
                <button onClick={onBatchAddCards} className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all">
                  {t('cards.import_cards')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cards table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr>
                    {[t('cards.rfid'), t('cards.owner_name'), t('cards.admin'), t('cards.owed'), t('cards.actions')].map((h, i) => (
                      <th key={h} className={`p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 ${[2,3,4].includes(i) ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {Array.isArray(cards) && cards.map((card) => (
                    <tr key={card.rfid} className="hover:bg-neutral-50 transition-colors">
                      <td className="p-6 font-mono text-sm text-neutral-600">{card.rfid}</td>
                      <td className="p-6 font-bold text-neutral-900">{card.ownerName ?? 'N/A'}</td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => onUpdateCards(cards.map((c) => c.rfid === card.rfid ? { ...c, isAdmin: !c.isAdmin } : c))}
                          role="switch" aria-checked={card.isAdmin}
                          className={`w-12 h-6 rounded-full transition-all mx-auto relative focus:outline-none ${card.isAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                          aria-label="Toggle Admin"
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${card.isAdmin ? 'left-[1.65rem]' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-neutral-400">€</span>
                          <input
                            type="number"
                            value={Number(card.balance) || 0}
                            aria-label={`Balance for ${card.ownerName}`}
                            onChange={(e) => onUpdateCards(cards.map((c) => c.rfid === card.rfid ? { ...c, balance: parseFloat(e.target.value) } : c))}
                            className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold text-right p-0 focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => onResetCardBalance(card.rfid)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.clear_balance_tooltip')} aria-label={t('cards.clear_balance_tooltip')}>
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => onRemoveCard(card.rfid)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.delete_card')} aria-label={t('cards.delete_card')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!Array.isArray(cards) || cards.length === 0) && (
                    <tr><td colSpan={5} className="p-12 text-center text-neutral-400 italic">{t('cards.no_cards')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add card form */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
            <h3 className="text-lg font-bold mb-5">{t('cards.add_new_card')}</h3>
            <div className="space-y-4">
              <button
                onClick={() => { setIsScanning(true); managerRfidRef.current?.focus(); }}
                tabIndex={-1}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${isScanning ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-neutral-100' : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900'}`}
              >
                <CreditCard className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
                {isScanning ? 'Waiting for Scan...' : t('cards.scan_to_register')}
              </button>

              {lastScanned && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Last Scanned RFID</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-neutral-900">{lastScanned}</span>
                    <button onClick={() => setNewCardRfid(lastScanned)} className="text-[10px] font-bold text-neutral-900 underline uppercase tracking-widest">Use</button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="newCardRfid" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">{t('cards.rfid')}</label>
                <input
                  id="newCardRfid"
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
                      setIsScanning(false);
                    }
                  }}
                  placeholder={t('cards.rfid_placeholder')}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="newCardOwner" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">{t('cards.owner_name')}</label>
                <input
                  id="newCardOwner"
                  type="text"
                  value={newCardOwner}
                  onChange={(e) => setNewCardOwner(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddManualCard(); } }}
                  placeholder={t('cards.owner_placeholder')}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  onClick={() => setNewCardIsAdmin(!newCardIsAdmin)}
                  role="switch" aria-checked={newCardIsAdmin}
                  className={`w-12 h-6 rounded-full transition-all relative focus:outline-none ${newCardIsAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  aria-label="Toggle Admin for new card"
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${newCardIsAdmin ? 'left-[1.65rem]' : 'left-0.5'}`} />
                </button>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">{t('cards.admin_privileges')}</span>
              </div>

              <button
                onClick={onAddManualCard}
                disabled={!newCardRfid || !newCardOwner}
                tabIndex={-1}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
              >
                {t('cards.add_new_card')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
