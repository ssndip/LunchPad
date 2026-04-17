/**
 * MenuTab — Feature 4: Smart paste parser with two-phase Parse → Preview → Apply
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, FileText, Calendar, CheckCircle2, Layers, ArrowUp, ArrowDown, X, Square, CheckSquare, RefreshCw, Truck, AlertTriangle } from 'lucide-react';
import { MenuItem } from '../../../types';
import { parsePastedMenu } from '../../../utils/menuParser';
import { useStore } from '../../../store/useStore';
import * as api from '../../../api';
import { getActivePreset, getAllPresets, FormatPreset, normalizeMenuText, applyItemOverrides } from '../../../utils/menuNormalizer';

import { useTranslation } from '../../../hooks/useTranslation';

interface MenuTabProps {
  editingMenu: MenuItem[];
  onAddItem: () => void;
  onUpdateItem: (id: number, field: keyof MenuItem, value: unknown) => void;
  onRemoveItem: (id: number) => void;
  onDeleteAll: () => void;
  onApplyMenu: (items: MenuItem[]) => void;
  confirm: (config: any) => void;
}

export const MenuTab: React.FC<MenuTabProps> = ({
  editingMenu,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onDeleteAll,
  onApplyMenu,
  confirm,
}) => {
  const { t } = useTranslation();
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<any | null>(null);
  const { token } = useStore();

  const [presets, setPresets] = React.useState<FormatPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('none');

  React.useEffect(() => {
    const loaded = getAllPresets();
    setPresets(loaded);
    const active = getActivePreset();
    if (active) setSelectedPresetId(active.id);
  }, []);

  const deliveryFee = useStore(s => s.deliveryFee);
  const setDeliveryFee = useStore(s => s.setDeliveryFee);
  const packagingFee = useStore(s => s.packagingFee);
  const setPackagingFee = useStore(s => s.setPackagingFee);
  // Helper to identify side dish items reliably across languages
  const isSideDishCategory = (category?: string) => {
    if (!category) return false;
    return /side dishes|гарнитур/i.test(category);
  };

  const isBBQCategory = (category?: string) => {
    if (!category) return false;
    return /bbq|скара/i.test(category);
  };

  const handleApplyPackagingFee = async () => {
    if (!token) return;
    try {
      await api.updateSettings(token, { packagingFee });
      confirm({
        title: t('modals.confirm'),
        message: t('modals.confirm_packaging_fee'),
        confirmText: 'OK',
        onConfirm: () => {}
      });
    } catch (err) {
      console.error('Failed to update packaging fee', err);
    }
  };

  const handleApplyDeliveryFee = async () => {
    if (!token) return;
    try {
      await api.updateSettings(token, { deliveryFee });
      confirm({
        title: t('modals.confirm'),
        message: t('modals.confirm_delivery_fee'),
        confirmText: 'OK',
        onConfirm: () => {}
      });
    } catch (err) {
      console.error('Failed to update delivery fee', err);
    }
  };

  /**
   * Internal Checkbox Selector for Side Dishes
   */
  const SideDishSelector: React.FC<{
    selected: string[];
    available: MenuItem[];
    onChange: (names: string[]) => void;
  }> = ({ selected, available, onChange }) => {
    const handleToggle = (name: string) => {
      if (selected.includes(name)) {
        onChange(selected.filter(s => s !== name));
      } else {
        onChange([...selected, name]);
      }
    };

    if (available.length === 0) {
      return <p className="text-[10px] text-red-400 italic">{t('menu.no_sides_found')}</p>;
    }

    return (
      <div className="flex flex-col gap-1.5 mt-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100 max-h-40 overflow-y-auto custom-scrollbar">
        <p className="text-[10px] font-bold text-neutral-400 mb-1 uppercase tracking-tight">{t('menu.allowed_sides')}</p>
        {available.map(item => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.name)}
            className="flex items-center gap-2 text-[10px] text-left hover:bg-white p-1 rounded-lg transition-colors group"
          >
            {selected.includes(item.name) ? (
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <Square className="w-3.5 h-3.5 text-neutral-300 group-hover:block hidden" />
            )}
            {!selected.includes(item.name) && <Square className="w-3.5 h-3.5 text-neutral-200 block group-hover:hidden" />}
            <span className={selected.includes(item.name) ? 'font-bold text-neutral-900' : 'text-neutral-500'}>
              {item.name}
            </span>
          </button>
        ))}
        {selected.length === 0 && (
          <p className="text-[9px] text-neutral-400 italic mt-1 border-t border-neutral-100 pt-1">
            * No specific sides selected: All sides allowed by default
          </p>
        )}
      </div>
    );
  };

  const handleParse = () => {
    if (!pasteText.trim()) return;
    const selectedPreset = presets.find(p => p.id === selectedPresetId) || null;
    const normalizedText = normalizeMenuText(pasteText, selectedPreset);
    
    // Visually update the text area so the user can see what the normalizer did
    if (normalizedText !== pasteText) {
      setPasteText(normalizedText);
    }

    const result = parsePastedMenu(normalizedText);
    const finalItems = applyItemOverrides(result.items, selectedPreset);
    setParsed({
      items: finalItems,
      date: result.detectedDate || null,
      unmatchedLines: result.unmatchedLines || []
    });
  };

  const handleApply = () => {
    if (!parsed || parsed.items.length === 0) return;
    // Explicitly confirm overwriting if there is an existing menu
    if (editingMenu.length > 0) {
      confirm({
        title: t('modals.confirm') || 'Confirm',
        message: t('modals.overwrite_warning') || 'This will replace the existing menu. Continue?',
        onConfirm: () => {
          onApplyMenu(parsed.items);
          setIsPasteOpen(false);
          setPasteText('');
          setParsed(null);
        }
      });
      return;
    }
    onApplyMenu(parsed.items);
    setIsPasteOpen(false);
    setPasteText('');
    setParsed(null);
  };

  const updateParsedItem = (index: number, field: keyof MenuItem, value: any) => {
    if (!parsed) return;
    const newItems = [...parsed.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setParsed({ ...parsed, items: newItems });
  };

  const removeParsedItem = (index: number) => {
    if (!parsed) return;
    const newItems = parsed.items.filter((_, i) => i !== index);
    setParsed({ ...parsed, items: newItems });
  };

  const moveParsedItem = (index: number, direction: 'up' | 'down') => {
    if (!parsed) return;
    const newItems = [...parsed.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setParsed({ ...parsed, items: newItems });
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
                confirm({
                  title: t('modals.remove_item') || 'Reset Menu',
                  message: t('modals.reset_warning') || 'Are you sure you want to delete all items?',
                  isDestructive: true,
                  onConfirm: () => onDeleteAll()
                });
              }}
              tabIndex={-1}
              className="flex items-center gap-2 px-5 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all text-sm"
            >
              <Trash2 className="w-4 h-4" /> {t('menu.delete_all') || 'Delete All'}
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl shadow-sm">
            <Truck className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">{t('orders.delivery_fee') || 'Default Fee'}:</span>
            <input 
              type="number" 
              step="0.1" 
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent border-none focus:ring-0 font-mono font-bold text-sm p-0 focus:outline-none"
            />
            <span className="text-xs text-neutral-400">€</span>
            <button 
              onClick={handleApplyDeliveryFee}
              className="ml-1 p-1 hover:bg-neutral-100 rounded-lg text-indigo-600 transition-colors"
              title="Apply Default Fee"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl shadow-sm">
            <Square className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">{t('menu.packaging_fee') || 'Box'}:</span>
            <input 
              type="number" 
              step="0.05" 
              value={packagingFee}
              onChange={(e) => setPackagingFee(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent border-none focus:ring-0 font-mono font-bold text-sm p-0 focus:outline-none"
            />
            <span className="text-xs text-neutral-400">€</span>
            <button 
              onClick={handleApplyPackagingFee}
              className="ml-1 p-1 hover:bg-neutral-100 rounded-lg text-indigo-600 transition-colors"
              title="Apply Fee"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
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
                {[t('menu.category'), t('menu.name'), t('menu.price'), t('menu.included_side') || 'Included Side', t('menu.status'), t('cards.actions')].map((h) => (
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
                    <div className="flex flex-col">
                      <button
                        onClick={() => onUpdateItem(item.id, 'hasIncludedSide', !item.hasIncludedSide)}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                          item.hasIncludedSide ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'bg-neutral-50 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500'
                        }`}
                        title={t('menu.included_side') || 'Included Side'}
                      >
                        <Layers className="w-5 h-5" />
                      </button>
                      
                      {item.hasIncludedSide && (
                        <SideDishSelector
                          selected={item.sideChoices || []}
                          available={editingMenu.filter(m => isSideDishCategory(m.category))}
                          onChange={(names) => onUpdateItem(item.id, 'sideChoices', names)}
                        />
                      )}
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
                    {presets.length > 0 && (
                      <div className="mt-4 flex items-center gap-3 bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('parser.format_preset')}</span>
                        <select
                          value={selectedPresetId}
                          onChange={e => setSelectedPresetId(e.target.value)}
                          className="flex-1 bg-neutral-50 border border-neutral-200 text-sm font-bold text-neutral-800 rounded-lg py-1.5 px-3 focus:outline-none focus:border-indigo-400 hover:border-neutral-300 transition-colors"
                        >
                          <option value="none">{t('parser.no_preset')}</option>
                          {presets.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex justify-end gap-3 mt-4">
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
                  <>
                    {parsed.date && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">
                          {t('menu.detected_date') || 'Detected date'}: <strong>{parsed.date}</strong>
                        </span>
                      </div>
                    )}

                    {parsed.unmatchedLines.length > 0 && (
                      <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                           <span className="text-xs font-bold block mb-1">{t('menu.unmatched_lines_detection')} ({parsed.unmatchedLines.length})</span>
                           <p className="text-[10px] opacity-80 leading-relaxed font-mono truncate">{parsed.unmatchedLines.join(', ')}</p>
                        </div>
                      </div>
                    )}

                    {parsed.items.length === 0 ? (
                      <p className="text-center text-sm text-neutral-400 italic py-8">
                        No items could be parsed. Check the format and try again.
                      </p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-2xl border border-neutral-200">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-100 z-10">
                            <tr>
                              <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-1/4">{t('menu.category')}</th>
                              <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-2/5">{t('menu.name')}</th>
                              <th className="p-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.price')}</th>
                              <th className="p-3 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.side')}</th>
                              <th className="p-3 text-right font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('cards.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {parsed.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50 group">
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.category}
                                    onChange={(e) => updateParsedItem(idx, 'category', e.target.value)}
                                    className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-[10px] uppercase tracking-widest text-neutral-400 focus:outline-none focus:border-neutral-400"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                                    className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-xs font-bold text-neutral-900 focus:outline-none focus:border-neutral-400"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => updateParsedItem(idx, 'price', parseFloat(e.target.value))}
                                    className="w-16 bg-white border border-neutral-200 rounded-lg p-1 text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-neutral-400"
                                  />
                                </td>
                                <td className="p-2 text-center align-top">
                                  <button
                                    onClick={() => updateParsedItem(idx, 'hasIncludedSide', !item.hasIncludedSide)}
                                    className={`p-1.5 rounded-lg transition-colors ${item.hasIncludedSide ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-300 hover:bg-neutral-100'}`}
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                  </button>
                                  {item.hasIncludedSide && (
                                    <div className="mt-1">
                                      <SideDishSelector
                                        selected={item.sideChoices || []}
                                        available={editingMenu.filter(m => isSideDishCategory(m.category))}
                                        onChange={(names) => updateParsedItem(idx, 'sideChoices', names)}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => moveParsedItem(idx, 'up')}
                                      disabled={idx === 0}
                                      className="p-1.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-0"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => moveParsedItem(idx, 'down')}
                                      disabled={idx === parsed.items.length - 1}
                                      className="p-1.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-0"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeParsedItem(idx)}
                                      className="p-1.5 text-neutral-300 hover:text-red-500"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
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
