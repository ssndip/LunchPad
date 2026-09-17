import React, { useRef } from 'react';
import { Trash2, Plus, CreditCard, RotateCcw, Pencil, Download, Upload, FileSpreadsheet, BarChart2, Radio } from 'lucide-react';
import { Card } from '../../../types';
import { NfcWriteModal } from '../modals/NfcWriteModal';

import { useTranslation } from '../../../hooks/useTranslation';
import { useNfcScanner } from '../../../hooks/useNfcScanner';
import { ACTIONS_COLUMN_KEY, DataList, DataListColumn, DataListRow } from '../../shared/DataList';
import { Sheet } from '../../shared/Sheet';
import { TabHeader } from '../../shared/TabHeader';

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

  /** A PIN column value from a spreadsheet, or undefined to leave it unset. */
  const importedPin = (raw: unknown): string | undefined => {
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!value || value.toUpperCase() === 'SET') return undefined;
    return value;
  };

  /**
   * The spreadsheet library, fetched the first time somebody imports or
   * exports. It is ~380kB minified — three quarters of this tab's bundle — for
   * two buttons most sessions never press, and it used to be a static import,
   * so every manager opening Card Management paid for it. Vite emits it as its
   * own chunk; the browser caches it after the first use.
   */
  const loadXLSX = () => import('xlsx');

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const XLSX = await loadXLSX();

    const data = cards.map(c => ({
      RFID: c.rfid,
      Name: c.ownerName,
      PIN: c.hasPin ? 'SET' : '',
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
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadXLSX();
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedCards: Card[] = data.map((row: any) => ({
          rfid: String(row.RFID || row.rfid || '').trim(),
          ownerName: String(row.Name || row.name || row.ownerName || 'User').trim(),
          // "SET" is the placeholder the export writes for a card that has a
          // PIN, since the digest itself is never sent to the client. Re-importing
          // an export must leave those PINs alone rather than try to set one.
          pin: importedPin(row.PIN ?? row.pin),
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

  const sortDir = (key: keyof Card): 'asc' | 'desc' | null =>
    sortConfig.key === key ? sortConfig.direction : null;

  const columns: DataListColumn[] = [
    { key: 'ownerName', label: t('cards.owner_name') || '', role: 'title', sortable: true, onSort: () => toggleSort('ownerName'), sortDirection: sortDir('ownerName') },
    { key: 'rfid', label: t('cards.rfid') || '', sortable: true, onSort: () => toggleSort('rfid'), sortDirection: sortDir('rfid') },
    { key: 'pin', label: t('cards.pin') || '', sortable: true, onSort: () => toggleSort('hasPin'), sortDirection: sortDir('hasPin') },
    { key: 'isAdmin', label: t('cards.admin') || '', align: 'center', sortable: true, onSort: () => toggleSort('isAdmin'), sortDirection: sortDir('isAdmin') },
    { key: 'balance', label: t('cards.owed') || '', align: 'center', sortable: true, onSort: () => toggleSort('balance'), sortDirection: sortDir('balance') },
    { key: ACTIONS_COLUMN_KEY, label: t('cards.actions') || '', align: 'center' },
  ];

  const rows: DataListRow[] = filteredAndSortedCards.map((card) => {
    const isEditing = editingRfid === card.rfid;
    const values = isEditing ? editValues : card;

    return {
      key: card.rfid,
      cells: {
        ownerName: isEditing ? (
          <input
            type="text"
            value={values.ownerName || ''}
            onChange={(e) => setEditValues({ ...values, ownerName: e.target.value })}
            className="w-full bg-neutral-50 px-3 py-1.5 touch-target-h rounded-lg border border-neutral-200 focus:ring-2 focus:ring-neutral-900 text-xs font-bold outline-none"
          />
        ) : (
          <span className="font-bold text-neutral-900">{card.ownerName ?? 'N/A'}</span>
        ),
        rfid: <span className="font-mono text-sm text-neutral-600">{card.rfid}</span>,
        pin: (
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={values.pin ?? ''}
            placeholder={card.hasPin ? '••••••' : '------'}
            title={card.hasPin
              ? 'A PIN is set. Type a new one to replace it, or clear the box to remove it.'
              : 'No PIN set. Type six digits to add one.'}
            onFocus={() => !isEditing && startEditing(card)}
            onChange={(e) => setEditValues({ ...values, pin: e.target.value.replace(/\D/g, '') })}
            className={`w-20 px-2 touch-target-h rounded-lg border font-mono text-center text-xs outline-none transition-all ${isEditing ? 'bg-white border-neutral-900 ring-1 ring-neutral-900' : 'bg-neutral-50 border-neutral-200'}`}
          />
        ),
        isAdmin: (
          <button
            onClick={() => isEditing ? setEditValues({ ...values, isAdmin: !values.isAdmin }) : startEditing({ ...card, isAdmin: !card.isAdmin })}
            role="switch" aria-checked={values.isAdmin}
            className={`w-12 h-6 rounded-full transition-all mx-auto relative focus:outline-none touch-target-phone ${values.isAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
            aria-label="Toggle Admin"
          >
            <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full transition-all ${values.isAdmin ? 'left-[1.65rem]' : 'left-0.5'}`} />
          </button>
        ),
        balance: (
          <div className="flex items-center justify-center gap-1">
            <span className="text-neutral-400 text-xs">€</span>
            {isEditing ? (
              <input
                type="number"
                value={values.balance || 0}
                onChange={(e) => setEditValues({ ...values, balance: parseFloat(e.target.value) })}
                className="w-16 bg-neutral-50 px-2 py-1 touch-target-h rounded-lg border border-neutral-200 focus:ring-2 focus:ring-neutral-900 text-xs font-mono font-bold text-right outline-none"
              />
            ) : (
              <span className="font-mono font-bold text-sm">{(Number(card.balance) || 0).toFixed(2)}</span>
            )}
          </div>
        ),
      },
      actions: (
        <div className="flex items-center justify-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => handleSave(card.rfid)}
                disabled={isSaving}
                className="p-2 flex items-center justify-center touch-target-phone bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                title={t('modals.save')}
              >
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <div className="flex items-center px-1"><Plus className="w-3.5 h-3.5 rotate-45" style={{transform:'rotate(0deg)'}} /><span className="text-[9px] font-black uppercase ml-0.5">OK</span></div>}
              </button>
              <button
                onClick={handleCancel}
                className="p-2 flex items-center justify-center touch-target-phone bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors"
                title={t('modals.cancel')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setNfcWriteCard(card)} className="p-2 flex items-center justify-center touch-target-phone hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors" title={t('cards.write_nfc')} aria-label={t('cards.write_nfc')}>
                <Radio className="w-4 h-4" />
              </button>
              <button onClick={() => onViewStats?.(card.rfid)} className="p-2 flex items-center justify-center touch-target-phone hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors" title="View Statistics" aria-label="View Statistics">
                <BarChart2 className="w-4 h-4" />
              </button>
              <button onClick={() => startEditing(card)} className="p-2 flex items-center justify-center touch-target-phone hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors" title={t('modals.edit')} aria-label={t('modals.edit')}>
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onResetCardBalance(card.rfid)} className="p-2 flex items-center justify-center touch-target-phone hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.clear_balance_tooltip')} aria-label={t('cards.clear_balance_tooltip')}>
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => onRemoveCard(card.rfid)} className="p-2 flex items-center justify-center touch-target-phone hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 transition-colors" title={t('cards.delete_card')} aria-label={t('cards.delete_card')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    };
  });

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv, .xlsx, .xls"
        className="hidden"
      />

      <TabHeader
        title={t('navigation.card_management')}
        subtitle={t('cards.management_desc')}
        primaryAction={{
          key: 'import-cards',
          label: t('cards.import_cards') || '',
          icon: Plus,
          onClick: () => setIsPasteCardsModalOpen(true),
        }}
        secondaryActions={[
          { key: 'export-xlsx', label: t('cards.export_xlsx') || '', icon: Download, onClick: () => handleExport('xlsx') },
          { key: 'export-csv', label: t('cards.export_csv') || '', icon: FileSpreadsheet, onClick: () => handleExport('csv') },
          { key: 'import-file', label: t('cards.import_file') || '', icon: Upload, onClick: () => fileInputRef.current?.click() },
          { key: 'reset-balances', label: t('cards.reset_monthly_balances') || '', icon: RotateCcw, isDestructive: true, onClick: onResetAllBalances },
        ]}
      />

      <Sheet
        isOpen={isPasteCardsModalOpen}
        onClose={() => setIsPasteCardsModalOpen(false)}
        title={t('cards.import_cards')}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <p className="text-neutral-500 text-sm -mt-2">{t('cards.import_instructions')}</p>
          <textarea
            value={pasteCardsText}
            onChange={(e) => setPasteCardsText(e.target.value)}
            placeholder={t('cards.import_placeholder')}
            className="w-full h-52 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none resize-none"
          />
          <div className="flex justify-end gap-4">
            <button onClick={() => setIsPasteCardsModalOpen(false)} className="px-6 py-3 touch-target-h text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all">
              {t('modals.cancel')}
            </button>
            <button onClick={onBatchAddCards} className="px-8 py-3 touch-target-h bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all">
              {t('cards.import_cards')}
            </button>
          </div>
        </div>
      </Sheet>

      {/* One column at every width, not `lg:grid-cols-3` with the table in a
          `lg:col-span-2`.
          Two thirds of the content area is less room than it sounds: the
          dashboard's own area is capped at `--app-max-width` (1440px) and
          loses DesktopNav's 320px aside plus `lg:p-10`, so that column peaked
          at 895px — while this six-column table needs 860px and needed 956px
          before DataList's padding came down. Measured in Chrome, it scrolled
          sideways at every width up to about 1900px, and ДЕЙСТВИЯ — edit,
          delete, reset balance, write NFC — was the column parked off-screen.
          The add-card form follows the table, which is the order this already
          used below lg. */}
      <div className="flex flex-col gap-8">
        {/* Cards table */}
        <div className="space-y-4">
          {/* Search Row */}
          <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('filters.search_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-100 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5 transition-all text-sm outline-none"
              />
              <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <div className="px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-100 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              {filteredAndSortedCards.length} {t('menu.items')}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
            <DataList
              columns={columns}
              rows={rows}
              emptyMessage={t('cards.no_cards') || ''}
              tableClassName="min-w-[500px]"
            />
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
                className={`w-full py-3 touch-target-h rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${isScanning ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-neutral-100' : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900'}`}
              >
                <CreditCard className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
                {isScanning ? t('menu.waiting_scan') : t('cards.scan_to_register')}
              </button>

              {lastScanned && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">{t('menu.last_scanned_rfid')}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-neutral-900">{lastScanned}</span>
                    <button onClick={() => setNewCardRfid(lastScanned)} className="flex items-center justify-center touch-target-phone text-[10px] font-bold text-neutral-900 underline uppercase tracking-widest">{t('menu.use')}</button>
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
                    className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none pr-10"
                  />
                  {nfcSupported && (
                    <button
                      type="button"
                      onClick={() => initializeNfc()}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 flex items-center justify-center touch-target-phone rounded-lg text-neutral-400 hover:text-indigo-600 transition-colors ${nfcScanning ? 'text-indigo-600 animate-pulse' : ''}`}
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
                  className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
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
                  className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  onClick={() => setNewCardIsAdmin(!newCardIsAdmin)}
                  role="switch" aria-checked={newCardIsAdmin}
                  className={`w-12 h-6 rounded-full transition-all relative focus:outline-none touch-target-phone ${newCardIsAdmin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  aria-label="Toggle Admin for new card"
                >
                  <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full transition-all ${newCardIsAdmin ? 'left-[1.65rem]' : 'left-0.5'}`} />
                </button>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">{t('cards.admin_privileges')}</span>
              </div>

              <button
                onClick={onAddManualCard}
                disabled={!newCardRfid || !newCardOwner}
                tabIndex={-1}
                className="w-full py-3 touch-target-h bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
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
