import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Trash2, Plus, CreditCard, RotateCcw, Pencil, Download, Upload, FileSpreadsheet, BarChart2, Radio } from 'lucide-react';
import { Card } from '../../../types';
import { NfcWriteModal } from '../modals/NfcWriteModal';

import { useTranslation } from '../../../hooks/useTranslation';
import { useNfcScanner } from '../../../hooks/useNfcScanner';

interface CardsTabProps {
  cards: Card[];
  onUpdateSingleCard: (rfid: string, card: Card) => Promise<boolean>;
  onRemoveCard: (rfid: string) => void;
  onResetCardBalance: (rfid: string) => void;
  onResetAllBalances: () => void;
  onAddManualCard: () => void;
  onBatchAddCards: (data?: Card[]) => void;
  // New card form
  newCardRfid: string;
  setNewCardRfid: (v: string) => void;
  newCardOwner: string;
  setNewCardOwner: (v: string) => void;
  newCardIsAdmin: boolean;
  setNewCardIsAdmin: (v: boolean) => void;
  newCardPin: string;
  setNewCardPin: (v: string) => void;
  lastScanned: string | null;
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  // Paste modal
  pasteCardsText: string;
  setPasteCardsText: (v: string) => void;
  isPasteCardsModalOpen: boolean;
  setIsPasteCardsModalOpen: (v: boolean) => void;
  onViewStats?: (rfid: string) => void;
}

export const CardsTab: React.FC<CardsTabProps> = ({
  cards,
  onUpdateSingleCard,
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
  newCardPin,
  setNewCardPin,
  onViewStats,
}) => {
  const { t } = useTranslation();
  const managerRfidRef = useRef<HTMLInputElement>(null);
  const [editingRfid, setEditingRfid] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState<Partial<Card>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [nfcWriteCard, setNfcWriteCard] = React.useState<Card | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { supported: nfcSupported, scanning: nfcScanning, error: nfcError, initialize: initializeNfc } = useNfcScanner({
    onScan: (scannedId) => {
      if (editingRfid) {
        setEditValues((prev) => ({ ...prev, rfid: scannedId }));
      } else {
        setNewCardRfid(scannedId);
      }
    },
    active: true,
  });

  // Search and Sort
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Card, direction: 'asc' | 'desc' }>({ 
    key: 'ownerName', 
    direction: 'asc' 
  });

  const filteredAndSortedCards = React.useMemo(() => {
    let result = [...cards];
    
    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.ownerName || '').toLowerCase().includes(q) || 
        (c.rfid || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Handle strings
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cards, searchQuery, sortConfig]);

  const toggleSort = (key: keyof Card) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const startEditing = (card: Card) => {
    setEditingRfid(card.rfid);
    setEditValues({ ...card });
  };

  const handleSave = async (rfid: string) => {
    setIsSaving(true);
    const success = await onUpdateSingleCard(rfid, editValues as Card);
    if (success) {
      setEditingRfid(null);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditingRfid(null);
    setEditValues({});
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const data = cards.map(c => ({
      RFID: c.rfid,
      Name: c.ownerName,
      PIN: c.pin || '',
      IsAdmin: c.isAdmin ? 'Yes' : 'No',
      Balance: c.balance.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cards');
    
    XLSX.writeFile(wb, `cards_export_${new Date().toISOString().split('T')[0]}.${format}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedCards: Card[] = data.map((row: any) => ({
          rfid: String(row.RFID || row.rfid || '').trim(),
          ownerName: String(row.Name || row.name || row.ownerName || 'User').trim(),
          pin: row.PIN || row.pin ? String(row.PIN || row.pin).trim() : undefined,
          isAdmin: row.IsAdmin === 'Yes' || row.isAdmin === true || row.isAdmin === 1,
          balance: parseFloat(row.Balance || row.balance || '0')
        })).filter(c => c.rfid);

        if (mappedCards.length > 0) {
          onBatchAddCards(mappedCards);
        } else {
          alert(t('cards.import_error'));
        }
      } catch (err) {
        console.error('Import failed', err);
        alert(t('cards.import_error'));
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.card_management')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">{t('cards.management_desc')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv, .xlsx, .xls"
            className="hidden" 
          />
          
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200">
            <button
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-xs shadow-sm"
              title={t('cards.export_xlsx')}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">XLSX</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-xs shadow-sm"
              title={t('cards.export_csv')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs shadow-lg shadow-indigo-100"
          >
            <Upload className="w-4 h-4" /> {t('cards.import_file')}
          </button>

          <button
            onClick={onResetAllBalances}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all text-xs"
          >
            <RotateCcw className="w-4 h-4" /> {t('cards.reset_monthly_balances')}
          </button>
          
          <button
            onClick={() => setIsPasteCardsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all text-xs"
          >
            <Plus className="w-4 h-4" /> {t('cards.import_cards')}
          </button>
        </div>
      </div>

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
        <div className="lg:col-span-2 space-y-4">
          {/* Search Row */}
          <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('filters.search_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-100 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5 transition-all text-sm outline-none"
              />
              <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <div className="px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-100 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              {filteredAndSortedCards.length} {t('menu.items')}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-neutral-50/50">
                    {[
                      { key: 'rfid' as keyof Card, label: t('cards.rfid') },
                      { key: 'ownerName' as keyof Card, label: t('cards.owner_name') },
                      { key: 'pin' as keyof Card, label: 'PIN' },
                      { key: 'isAdmin' as keyof Card, label: t('cards.admin') },
                      { key: 'balance' as keyof Card, label: t('cards.owed') },
                    ].map((col) => (
                      <th 
                        key={col.key} 
                        onClick={() => toggleSort(col.key)}
                        className={`p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 cursor-pointer hover:text-neutral-900 transition-colors group ${['isAdmin', 'balance'].includes(col.key) ? 'text-center' : ''}`}
                      >
                        <div className={`flex items-center gap-2 ${['isAdmin', 'balance'].includes(col.key) ? 'justify-center' : ''}`}>
                          {col.label}
                          <div className={`transition-all ${sortConfig.key === col.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}`}>
                            {sortConfig.key === col.key && sortConfig.direction === 'desc' ? (
                              <RotateCcw className="w-3 h-3 rotate-180" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 text-center">{t('cards.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredAndSortedCards.map((card) => {
                    const isEditing = editingRfid === card.rfid;
                    const values = isEditing ? editValues : card;

                    return (
                      <tr key={card.rfid} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-6 font-mono text-sm text-neutral-600">{card.rfid}</td>
                        <td className="p-6">
                          {isEditing ? (
                            <input
                              type="text"
                              value={values.ownerName || ''}
                              onChange={(e) => setEditValues({ ...values, ownerName: e.target.value })}
                              className="w-full bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-neutral-900 text-xs font-bold outline-none"
                            />
                          ) : (
                            <span className="font-bold text-neutral-900">{card.ownerName ?? 'N/A'}</span>
                          )}
                        </td>
                        <td className="p-6">
                          <input
                            type="text"
                            maxLength={6}
                            value={values.pin || ''}
                            placeholder="------"
                            onFocus={() => !isEditing && startEditing(card)}
                            onChange={(e) => setEditValues({ ...values, pin: e.target.value.replace(/\D/g, '') })}
                            className={`w-20 px-2 py-1.5 rounded-lg border font-mono text-center text-xs outline-none transition-all ${isEditing ? 'bg-white border-neutral-900 ring-1 ring-neutral-900' : 'bg-neutral-50 border-neutral-200'}`}
                          />
                        </td>
                        <td className="p-6 text-center">
                          <button
                            onClick={() => isEditing ? setEditValues({ ...values, isAdmin: !values.isAdmin }) : startEditing({ ...card, isAdmin: !card.isAdmin })}
                            role="switch" aria-checked={values.isAdmin}
                            className={`w-12 h-6 rounded-full transition-all mx-auto relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${values.isAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                            aria-label="Toggle Admin"
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${values.isAdmin ? 'left-[1.65rem]' : 'left-0.5'}`} />
                          </button>
                        </td>
                        <td className="p-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-neutral-400 text-xs">€</span>
                            {isEditing ? (
                              <input
                                type="number"
                                value={values.balance || 0}
                                onChange={(e) => setEditValues({ ...values, balance: parseFloat(e.target.value) })}
                                className="w-16 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-neutral-900 text-xs font-mono font-bold text-right outline-none"
                              />
                            ) : (
                              <span className="font-mono font-bold text-sm">{(Number(card.balance) || 0).toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSave(card.rfid)}
                                  disabled={isSaving}
                                  className="p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                                  title={t('modals.save')}
                                >
                                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <div className="flex items-center px-1"><Plus className="w-3.5 h-3.5 rotate-45" style={{transform:'rotate(0deg)'}} /><span className="text-[9px] font-black uppercase ml-0.5">OK</span></div>}
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="p-2 bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors"
                                  title={t('modals.cancel')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setNfcWriteCard(card)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors" title={t('cards.write_nfc')} aria-label={t('cards.write_nfc')}>
                                  <Radio className="w-4 h-4" />
                                </button>
                                <button onClick={() => onViewStats?.(card.rfid)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors" title="View Statistics" aria-label="View Statistics">
                                  <BarChart2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => startEditing(card)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors" title={t('modals.edit')} aria-label={t('modals.edit')}>
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => onResetCardBalance(card.rfid)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.clear_balance_tooltip')} aria-label={t('cards.clear_balance_tooltip')}>
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button onClick={() => onRemoveCard(card.rfid)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.delete_card')} aria-label={t('cards.delete_card')}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAndSortedCards.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-neutral-400 italic">{t('cards.no_cards')}</td></tr>
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
                {isScanning ? t('menu.waiting_scan') : t('cards.scan_to_register')}
              </button>

              {lastScanned && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">{t('menu.last_scanned_rfid')}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-neutral-900">{lastScanned}</span>
                    <button onClick={() => setNewCardRfid(lastScanned)} className="text-[10px] font-bold text-neutral-900 underline uppercase tracking-widest">{t('menu.use')}</button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="newCardRfid" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">{t('cards.rfid')}</label>
                <div className="relative">
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
                    className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none pr-10"
                  />
                  {nfcSupported && (
                    <button
                      type="button"
                      onClick={() => initializeNfc()}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors ${nfcScanning ? 'text-indigo-600 animate-pulse' : ''}`}
                      title={nfcError || (nfcScanning ? 'NFC Scanning Active' : 'Scan NFC tag to auto-fill RFID')}
                      aria-label="Scan NFC tag to auto-fill RFID"
                    >
                      <Radio className="w-4 h-4" />
                    </button>
                  )}
                </div>
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

              <div>
                <label htmlFor="newCardPin" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">Order PIN (Optional)</label>
                <input
                  id="newCardPin"
                  type="text"
                  maxLength={6}
                  value={newCardPin}
                  onChange={(e) => setNewCardPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 digits PIN"
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  onClick={() => setNewCardIsAdmin(!newCardIsAdmin)}
                  role="switch" aria-checked={newCardIsAdmin}
                  className={`w-12 h-6 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${newCardIsAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
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

      <NfcWriteModal
        card={nfcWriteCard}
        onClose={() => setNfcWriteCard(null)}
      />
    </>
  );
};
