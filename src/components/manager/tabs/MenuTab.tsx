/**
 * MenuTab — Feature 4: Smart paste parser with two-phase Parse → Preview → Apply
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { MenuItem } from '../../../types';
import { parsePastedMenu, ParseResult } from '../../../utils/menuParser';

interface MenuTabProps {
  editingMenu: MenuItem[];
  onAddItem: () => void;
  onUpdateItem: (id: number, field: keyof MenuItem, value: unknown) => void;
  onRemoveItem: (id: number) => void;
  onDeleteAll: () => void;
  onApplyMenu: (items: MenuItem[]) => void;
  t: (key: string) => string;
}

export const MenuTab: React.FC<MenuTabProps> = ({
  editingMenu,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onDeleteAll,
  onApplyMenu,
  t,
}) => {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const handleParse = () => {
    if (!pasteText.trim()) return;
    const result = parsePastedMenu(pasteText);
    setParsed(result);
  };

  const handleApply = () => {
    if (!parsed || parsed.items.length === 0) return;
    onApplyMenu(parsed.items);
    setIsPasteOpen(false);
    setPasteText('');
    setParsed(null);
  };

  const handleClose = () => {
    setIsPasteOpen(false);
    setPasteText('');
    setParsed(null);
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.menu_management')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">{t('menu.management_desc')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {editingMenu.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(t('modals.delete_menu_warning'))) {
                  onDeleteAll();
                }
              }}
              tabIndex={-1}
              className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all text-sm shadow-lg shadow-red-100 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> {t('menu.delete_all') || 'Delete All'}
            </button>
          )}
          <button
            onClick={() => setIsPasteOpen(true)}
            tabIndex={-1}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all text-sm shadow-sm"
          >
            <FileText className="w-4 h-4" /> {t('menu.paste_title')}
          </button>
          <button
            onClick={onAddItem}
            tabIndex={-1}
            className="flex items-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all text-sm shadow-md shadow-neutral-200"
          >
            <Plus className="w-4 h-4" /> {t('menu.add_item')}
          </button>
        </div>
      </div>

      {/* Menu Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr>
                {[t('menu.category'), t('menu.name'), t('menu.price'), t('menu.status'), t('cards.actions')].map((h) => (
                  <th key={h} className="p-5 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {editingMenu.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="p-5">
                    <input
                      type="text"
                      value={item.category ?? ''}
                      aria-label={`Category for ${item.name}`}
                      onChange={(e) => onUpdateItem(item.id, 'category', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-neutral-400 text-xs uppercase tracking-widest p-0 focus:outline-none"
                    />
                  </td>
                  <td className="p-5">
                    <input
                      type="text"
                      value={item.name ?? ''}
                      aria-label={`Name for ${item.name}`}
                      onChange={(e) => onUpdateItem(item.id, 'name', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 font-bold text-neutral-900 p-0 focus:outline-none"
                    />
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400">€</span>
                      <input
                        type="number"
                        value={item.price ?? 0}
                        aria-label={`Price for ${item.name}`}
                        onChange={(e) => onUpdateItem(item.id, 'price', parseFloat(e.target.value))}
                        className="w-20 bg-transparent border-none focus:ring-0 font-mono font-bold p-0 focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-5">
                    <button
                      onClick={() => onUpdateItem(item.id, 'available', !item.available)}
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
                        item.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.available ? t('menu.active') : t('menu.inactive')}
                    </button>
                  </td>
                  <td className="p-5">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {editingMenu.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-neutral-400 italic text-sm">
                    No menu items yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paste Modal ── */}
      <AnimatePresence>
        {isPasteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-neutral-100">
                <h2 className="text-2xl font-bold mb-1">{t('menu.paste_title')}</h2>
                <p className="text-neutral-500 text-sm">{t('menu.paste_instructions')}</p>
              </div>

              <div className="p-8 space-y-6">
                {!parsed ? (
                  /* ── Phase 1: Paste ── */
                  <>
                    <div className="relative">
                      <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={t('menu.paste_placeholder')}
                        className="w-full h-56 p-5 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 focus:border-neutral-400 focus:outline-none transition-all font-mono text-sm resize-none"
                      />
                      <FileText className="absolute top-4 right-4 w-4 h-4 text-neutral-300" />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button onClick={handleClose} className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all">
                        {t('modals.cancel')}
                      </button>
                      <button
                        onClick={handleParse}
                        disabled={!pasteText.trim()}
                        className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40"
                      >
                        {t('menu.parse_button') || 'Parse →'}
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Phase 2: Preview ── */
                  <>
                    {parsed.detectedDate && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">
                          {t('menu.detected_date') || 'Detected date'}: <strong>{parsed.detectedDate}</strong>
                        </span>
                      </div>
                    )}

                    {parsed.items.length === 0 ? (
                      <p className="text-center text-sm text-neutral-400 italic py-8">
                        No items could be parsed. Check the format and try again.
                      </p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-2xl border border-neutral-200">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-100">
                            <tr>
                              <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.category')}</th>
                              <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.name')}</th>
                              <th className="p-3 text-right font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.price')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {parsed.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50">
                                <td className="p-3 text-[10px] uppercase tracking-widest text-neutral-400">{item.category}</td>
                                <td className="p-3 font-bold text-neutral-900">{item.name}</td>
                                <td className="p-3 text-right font-mono font-bold text-neutral-900">€{item.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex justify-between gap-3">
                      <button onClick={() => setParsed(null)} className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all">
                        ← {t('menu.edit_text') || 'Edit Text'}
                      </button>
                      <div className="flex gap-3">
                        <button onClick={handleClose} className="px-6 py-3 text-neutral-500 font-bold hover:bg-neutral-50 rounded-xl transition-all">
                          {t('modals.cancel')}
                        </button>
                        <button
                          onClick={handleApply}
                          disabled={parsed.items.length === 0}
                          className="flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {t('menu.apply_menu') || 'Apply Menu'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
