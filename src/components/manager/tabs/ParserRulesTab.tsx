/**
 * ParserRulesTab — Three-phase admin tool:
 *  1. Category Settings: per-category autobox + side-dish toggles (saved to localStorage)
 *  2. Live Parser Preview with Visual Line Classifier (Phase B)
 *  3. Smart Format Normalizer with heuristic rules + saved presets (Phase A lite)
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, Layers, Play, Zap, Save, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, FolderOpen, Plus, Trash2,
  Calendar, X, Check, Sparkles, BookOpen, Tag,
  Download, Upload, History
} from 'lucide-react';
import { MenuItem } from '../../../types';
import { parsePastedMenu } from '../../../utils/menuParser';
import { MENU_CONFIG } from '../../../utils/menuConfig';
import { FormatPreset, applyItemOverrides, normalizeMenuText } from '../../../utils/menuNormalizer';
import {
  loadCategorySettings, saveCategorySettings,
  AllCategorySettings, DEFAULT_CATEGORY_SETTINGS,
  ParserPersistence
} from '../../../utils/parserLocalSettings';

// ─── Types ────────────────────────────────────────────────────────────────────


type ClassifyAction = 'category' | 'item' | 'ignore';

interface ClassifyState {
  line: string;
  index: number;
  action: ClassifyAction | null;
  inputValue: string;
}

interface ParserProfile {
  id: string;
  name: string;
  settings: ParserPersistence;
  presets: FormatPreset[];
  createdAt: string;
}

interface ParserRulesTabProps {
  t: (key: string) => string;
  confirm: (cfg: any) => void;
}

// ─── Category color mapping ───────────────────────────────────────────────────

const CAT_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  soups:    { dot: 'bg-orange-400', bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800' },
  mains:    { dot: 'bg-blue-500',   bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800' },
  salads:   { dot: 'bg-green-500',  bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800' },
  bread:    { dot: 'bg-amber-400',  bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800' },
  sides:    { dot: 'bg-teal-500',   bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-800' },
  bbq:      { dot: 'bg-red-500',    bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800' },
  desserts: { dot: 'bg-purple-500', bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800' },
  other:    { dot: 'bg-neutral-400',bg: 'bg-neutral-50', border: 'border-neutral-200',text: 'text-neutral-700' },
};

const getCatKey = (label: string) => {
  const entry = Object.entries(MENU_CONFIG.categoryLabels).find(([, v]) => v === label);
  return entry ? entry[0] : 'other';
};

const PRESETS_KEY = 'lunchpad_format_presets';
const PROFILES_KEY = 'lunchpad_parser_profiles';

// ─── Component ────────────────────────────────────────────────────────────────

export const ParserRulesTab: React.FC<ParserRulesTabProps> = ({ t, confirm }) => {
  // ── State ──
  const [settings, setSettings] = useState<ParserPersistence>(() => loadCategorySettings());
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  const [previewText, setPreviewText] = useState('');
  const [parseResult, setParseResult] = useState<{ items: MenuItem[]; detectedDate?: string; unmatchedLines: string[] } | null>(null);

  const [classify, setClassify] = useState<ClassifyState | null>(null);
  const [remapItem, setRemapItem] = useState<string | null>(null);
  const [renameItem, setRenameItem] = useState<{name: string, newName: string} | null>(null);
  const [presets, setPresets] = useState<FormatPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [manualRulePreset, setManualRulePreset] = useState<string | null>(null);
  const [manualRuleFind, setManualRuleFind] = useState('');
  const [manualRuleReplace, setManualRuleReplace] = useState('');
  const [profiles, setProfiles] = useState<ParserProfile[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Derived active preset & persistence ──
  const activePresetId = settings.activePresetId || null;
  const setActivePresetId = (id: string | null) => {
    setSettings(prev => {
      const updated = { ...prev, activePresetId: id };
      saveCategorySettings(updated);
      return updated;
    });
  };

  // ── Bootstrap ──
  useEffect(() => {
    setSettings(loadCategorySettings());
    const rawPr = localStorage.getItem(PRESETS_KEY);
    if (rawPr) setPresets(JSON.parse(rawPr));
    const rawProfiles = localStorage.getItem(PROFILES_KEY);
    if (rawProfiles) setProfiles(JSON.parse(rawProfiles));
  }, []);

  // ── Category Settings ──
  const toggleCat = (key: string, field: 'autoBox' | 'hasSideDish') => {
    setSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: { ...prev.categories[key], [field]: !prev.categories[key]?.[field] }
      }
    }));
  };

  const handleSaveSettings = () => {
    saveCategorySettings(settings);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  // ── Profile Versioning ──
  const saveProfiles = (updated: ParserProfile[]) => {
    setProfiles(updated);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
  };

  const handleSaveCurrentAsProfile = (name?: string) => {
    const defaultName = `Snapshot ${new Date().toLocaleString('bg-BG')}`;
    const profileName = typeof name === 'string' ? name : defaultName;
    
    const newProfile: ParserProfile = {
      id: new Date().toISOString(),
      name: profileName,
      settings: JSON.parse(JSON.stringify(settings)),
      presets: JSON.parse(JSON.stringify(presets)),
      createdAt: new Date().toISOString()
    };
    
    saveProfiles([newProfile, ...profiles]);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleActivateProfile = (profile: ParserProfile) => {
    confirm({
      title: t('parser.activate_profile'),
      message: `${t('parser.activate_warning')} "${profile.name}"?`,
      confirmText: t('parser.activate_button'),
      onConfirm: () => {
        // Overwrite active config
        setSettings(profile.settings);
        saveCategorySettings(profile.settings);
        setPresets(profile.presets);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(profile.presets));
        
        // Trigger a parse with the new settings
        setTimeout(() => handleParse(profile.presets, profile.settings.activePresetId), 100);
      }
    });
  };

  const handleExportProfile = (profile: ParserProfile) => {
    const dataStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const exportFileDefaultName = `lunchpad_parser_${profile.name.replace(/\s+/g, '_').toLowerCase()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.settings || !json.presets) {
          throw new Error('Invalid format');
        }

        const newProfile: ParserProfile = {
          id: new Date().toISOString(),
          name: json.name || `Imported ${new Date().toLocaleDateString()}`,
          settings: json.settings,
          presets: json.presets,
          createdAt: new Date().toISOString()
        };

        saveProfiles([newProfile, ...profiles]);
      } catch (err) {
        alert('Failed to import: Invalid JSON or format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteProfile = (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    saveProfiles(updated);
  };

  // ── Parse ──
  const handleParse = (forcedPresets?: FormatPreset[] | React.MouseEvent, forcedPresetId?: string | null) => {
    if (!previewText.trim()) return;
    
    // If called from onClick, the first arg is a React Event
    const isEvent = forcedPresets && !Array.isArray(forcedPresets);
    const currentList = (forcedPresets && Array.isArray(forcedPresets)) ? forcedPresets : presets;
    const currentActiveId = (forcedPresetId !== undefined && !isEvent) ? forcedPresetId : activePresetId;
    
    const activePreset = currentList.find(p => p.id === currentActiveId);
    
    // Explicitly run normalizer to match MenuTab's behavior perfectly
    const normalizedText = normalizeMenuText(previewText, activePreset);
    
    if (normalizedText !== previewText && !forcedPresets) {
      setPreviewText(normalizedText); 
    }

    const result = parsePastedMenu(normalizedText);
    const finalItems = applyItemOverrides(result.items, activePreset);
    setParseResult({ ...result, items: finalItems });
    setClassify(null);
  };

  // ── Phase A Lite: Heuristic Smart Normalizer ──
  const handleNormalize = () => {
    if (!previewText.trim()) return;
    setIsNormalizing(true);

    const activePreset = presets.find(p => p.id === activePresetId);
    const text = normalizeMenuText(previewText, activePreset);

    setPreviewText(text);
    setIsNormalizing(false);
    
    // Auto-parse after normalize
    setTimeout(() => {
      const result = parsePastedMenu(text);
      const finalItems = applyItemOverrides(result.items, activePreset);
      setParseResult({ ...result, items: finalItems });
    }, 50);
  };

  // ── Phase B: Line Classifier actions ──
  const applyClassify = () => {
    if (!classify || !classify.action) return;
    const { line, action, inputValue } = classify;

    if (action === 'category') {
      // Save a preset rule: replace this exact line with the standard category keyword 
      addPresetRule({ find: line.trim(), replace: inputValue.trim(), isRegex: false });
    } else if (action === 'item') {
      // Save a preset rule: prepend "- " to this line pattern
      addPresetRule({ find: `^(${line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, replace: '- $1', isRegex: true });
    } else if (action === 'ignore') {
      // Save a preset rule: remove this line
      addPresetRule({ find: line.trim(), replace: '', isRegex: false });
    }

    // Remove from unmatched lines locally
    setParseResult(prev => prev ? {
      ...prev,
      unmatchedLines: prev.unmatchedLines.filter((_, i) => i !== classify.index)
    } : null);
    setClassify(null);
  };

  // ── Preset Management ──
  const addPresetRuleSync = (rule: { find: string; replace: string; isRegex: boolean }) => {
    let updated = [...presets];
    let targetId = activePresetId;
    if (targetId) {
      const idx = updated.findIndex(p => p.id === targetId);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], preprocessRules: [...updated[idx].preprocessRules, rule] };
      }
    } else {
      const now = new Date().toISOString();
      const newPreset: FormatPreset = { id: now, name: `Preset ${updated.length + 1}`, preprocessRules: [rule], createdAt: now };
      updated.push(newPreset);
      targetId = now;
      setActivePresetId(now);
    }
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    return { updatedPresets: updated, activeId: targetId };
  };

  const addPresetRule = (rule: { find: string; replace: string; isRegex: boolean }) => {
    addPresetRuleSync(rule);
  };

  const addCategoryOverrideRule = (itemName: string, newCategory: string) => {
    let updated = [...presets];
    let targetId = activePresetId;
    
    // Auto-create preset if none active
    if (!targetId) {
      const now = new Date().toISOString();
      const newPreset: FormatPreset = { id: now, name: `Preset ${updated.length + 1}`, preprocessRules: [], createdAt: now };
      updated.push(newPreset);
      targetId = now;
      setActivePresetId(now);
    }

    const idx = updated.findIndex(p => p.id === targetId);
    if (idx >= 0) {
      const overrides = { ...(updated[idx].itemCategoryOverrides || {}) };
      overrides[itemName] = newCategory;
      updated[idx] = { ...updated[idx], itemCategoryOverrides: overrides };
    }
    
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setRemapItem(null);
    handleParse(updated, targetId);
  };

  const addNameOverrideRule = (itemName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === itemName) {
      setRenameItem(null);
      return;
    }
    
    let updated = [...presets];
    let targetId = activePresetId;
    
    // Auto-create preset if none active
    if (!targetId) {
      const now = new Date().toISOString();
      const newPreset: FormatPreset = { id: now, name: `Preset ${updated.length + 1}`, preprocessRules: [], createdAt: now };
      updated.push(newPreset);
      targetId = now;
      setActivePresetId(now);
    }

    const idx = updated.findIndex(p => p.id === targetId);
    if (idx >= 0) {
      const overrides = { ...(updated[idx].itemNameOverrides || {}) };
      overrides[itemName] = newName.trim();
      updated[idx] = { ...updated[idx], itemNameOverrides: overrides };
    }
    
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setRenameItem(null);
    handleParse(updated, targetId);
  };

  const addRemoveItemRule = (itemName: string) => {
    const { updatedPresets, activeId } = addPresetRuleSync({ find: itemName, replace: '', isRegex: false });
    handleParse(updatedPresets, activeId);
  };

  const duplicateActivePresetAsNew = () => {
    const active = presets.find(p => p.id === activePresetId);
    if (!active) return;
    
    confirm({
      title: t('parser.duplicate_preset'),
      message: t('parser.duplicate_desc'),
      isPrompt: true,
      initialValue: `${active.name} (Copy)`,
      confirmText: t('parser.duplicate_button'),
      onConfirm: (name) => {
        if (!name) return;
        const now = new Date().toISOString();
        const newPreset: FormatPreset = { ...active, id: now, name, createdAt: now };
        const updated = [...presets, newPreset];
        setPresets(updated);
        setActivePresetId(now);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
      }
    });
  };

  const createPreset = () => {
    if (!newPresetName.trim()) return;
    const now = new Date().toISOString();
    const preset: FormatPreset = { id: now, name: newPresetName.trim(), preprocessRules: [], createdAt: now };
    const updated = [...presets, preset];
    setPresets(updated);
    setActivePresetId(preset.id);
    setNewPresetName('');
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  };

  const applyPreset = (preset: FormatPreset) => {
    setActivePresetId(preset.id);
    // Directly run normalization with the preset, since state hasn't updated yet!
    if (!previewText.trim()) return;
    setIsNormalizing(true);
    const normalizedText = normalizeMenuText(previewText, preset);
    setPreviewText(normalizedText);
    setIsNormalizing(false);

    setTimeout(() => {
      const result = parsePastedMenu(normalizedText);
      const finalItems = applyItemOverrides(result.items, preset);
      setParseResult({ ...result, items: finalItems });
    }, 50);
  };

  // ── Group items for display ──
  const groupedItems: Record<string, MenuItem[]> = parseResult
    ? parseResult.items.reduce<Record<string, MenuItem[]>>((acc, item) => {
        const key = item.category || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : {};

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">

      {/* ══ SECTION 0: Profiles & Versioning ══ */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-100">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight">{t('parser.profiles_title')}</h3>
                <p className="text-[10px] text-neutral-400 font-medium">{t('parser.snapshot_tip')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveCurrentAsProfile()}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all shadow-md active:scale-95"
              >
                <Save className="w-3.5 h-3.5" /> {t('parser.save_snapshot')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 text-neutral-700 rounded-xl font-bold text-xs hover:bg-neutral-50 transition-all active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" /> {t('parser.import_new')}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportFile} 
                className="hidden" 
                accept=".json"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {profiles.length === 0 && (
              <div className="col-span-full py-12 text-center bg-neutral-50/50 rounded-3xl border border-dashed border-neutral-200">
                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-neutral-300" />
                </div>
                <p className="text-xs text-neutral-400 font-bold">{t('parser.no_versions')}</p>
              </div>
            )}
            {profiles.map(profile => (
              <div 
                key={profile.id}
                className="group relative p-5 bg-white border border-neutral-100 rounded-2xl hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-neutral-900 truncate pr-8">{profile.name}</p>
                    <p className="text-[9px] text-neutral-400 font-mono mt-1 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(profile.createdAt).toLocaleString('bg-BG')}
                    </p>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => handleExportProfile(profile)}
                      className="p-1.5 text-neutral-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                      title={t('parser.export_json')}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => confirm({ 
                        title: t('modals.delete_warning'), 
                        message: `${t('modals.delete_warning')} "${profile.name}"?`, 
                        isDestructive: true, 
                        onConfirm: () => deleteProfile(profile.id) 
                      })}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => handleActivateProfile(profile)}
                  className="w-full py-2 bg-neutral-50 text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-violet-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                >
                  <Play className="w-2.5 h-2.5 transition-transform group-hover/btn:translate-x-0.5" />
                  {t('parser.activate')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ SECTION 1: Category Settings ══ */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        <div
          className="w-full flex items-center justify-between p-6 border-b border-neutral-50 bg-neutral-50/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-900 rounded-xl flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900">{t('parser.category_settings')}</h2>
              <p className="text-[10px] text-neutral-400 mt-0.5">{t('parser.category_settings_desc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {savedToast && (
                <motion.span
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-1.5 text-green-600 text-[10px] font-black uppercase tracking-widest"
                >
                  <Check className="w-3 h-3" /> {t('parser.saved')}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={() => handleSaveSettings()}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
            >
              <Save className="w-3.5 h-3.5" /> {t('parser.save_settings')}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Header row */}
          <div className="col-span-full grid grid-cols-[1fr_auto_auto] gap-4 px-3 pb-1 border-b border-neutral-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('menu.category')}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 w-24 text-center flex items-center gap-1 justify-center"><Package className="w-3 h-3" /> {t('parser.auto_box')}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 w-24 text-center flex items-center gap-1 justify-center"><Layers className="w-3 h-3" /> {t('parser.side_dish')}</span>
          </div>

          {Object.entries(MENU_CONFIG.categoryLabels).map(([key, label]) => {
            const colors = CAT_COLORS[key] || CAT_COLORS.other;
            const setting = settings.categories[key] || { autoBox: false, hasSideDish: false };
            return (
              <div
                key={key}
                className={`col-span-full grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 rounded-2xl border ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} />
                  <span className={`text-sm font-bold ${colors.text}`}>{t(`categories.${key}`)}</span>
                  <span className="text-[9px] font-mono text-neutral-400">{key}</span>
                </div>

                {/* Auto Box Toggle */}
                <button
                  onClick={() => toggleCat(key, 'autoBox')}
                  className={`w-24 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    setting.autoBox
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                      : 'bg-white text-neutral-400 border-neutral-200 hover:border-amber-300'
                  }`}
                >
                  {setting.autoBox ? `✓ ${t('modals.open')}` : t('modals.close')}
                </button>

                {/* Side Dish Toggle */}
                <button
                  onClick={() => toggleCat(key, 'hasSideDish')}
                  className={`w-24 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    setting.hasSideDish
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-neutral-400 border-neutral-200 hover:border-indigo-300'
                  }`}
                >
                  {setting.hasSideDish ? `✓ ${t('modals.open')}` : t('modals.close')}
                </button>
              </div>
            );
          })}


          <div className="col-span-full pt-4 border-t border-neutral-100 mt-2">
            <div className="flex flex-col gap-2 max-w-md">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                {t('parser.trigger_keyword')}
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={settings.sideDishKeyword}
                  onChange={(e) => setSettings(prev => ({ ...prev, sideDishKeyword: e.target.value }))}
                  placeholder="e.g. с гарнитура"
                  className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
              <p className="text-[9px] text-neutral-400 leading-relaxed italic">
                {t('parser.trigger_desc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ SECTION 2: Live Parser Preview ══ */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-50 bg-neutral-50/10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-neutral-900 rounded-xl flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900">{t('parser.live_preview')}</h2>
              <p className="text-[10px] text-neutral-400 mt-0.5">{t('parser.live_preview_desc')}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: input */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <textarea
                value={previewText}
                onChange={e => setPreviewText(e.target.value)}
                placeholder={`Меню за 09.04.2026\n\nОсновно ястие:\n- Кюфтета 3.20€\n- Татарско кюфте с гарнитура 3.40€\n\nГарнитури:\n200гр 1.50€ + 0.10€ кутийка\n- Шопска салата`}
                className="w-full h-80 p-5 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 focus:border-neutral-400 focus:outline-none font-mono text-xs resize-none text-neutral-700 placeholder:text-neutral-300"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleParse}
                  disabled={!previewText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-200"
                >
                  <Play className="w-4 h-4" /> {t('parser.parse_button')}
                </button>
                <button
                  onClick={handleNormalize}
                  disabled={!previewText.trim() || isNormalizing}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40 shadow-xl shadow-indigo-100"
                >
                  <Sparkles className="w-4 h-4" />
                  {isNormalizing ? t('parser.normalizing') : `✨ ${t('parser.auto_format')}`}
                </button>
              </div>
            </div>

            {/* Right: results */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {!parseResult && (
                <div className="h-full flex items-center justify-center text-center p-8 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <p className="text-xs text-neutral-300 font-bold">{t('parser.results_placeholder')}</p>
                </div>
              )}
              {parseResult && (
                <>
                  {/* Summary */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {parseResult.detectedDate && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold text-amber-800">
                        <Calendar className="w-3 h-3" /> {parseResult.detectedDate}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl text-[10px] font-bold text-green-800">
                      <CheckCircle2 className="w-3 h-3" /> {parseResult.items.length} {t('parser.items')}
                    </div>
                    {parseResult.unmatchedLines.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-[10px] font-bold text-red-700">
                        <AlertTriangle className="w-3 h-3" /> {parseResult.unmatchedLines.length} {t('parser.unmatched')}
                      </div>
                    )}
                  </div>
                  {/* Items by category */}
                  {Object.entries(groupedItems).map(([cat, items]) => {
                    const key = getCatKey(cat);
                    const colors = CAT_COLORS[key] || CAT_COLORS.other;
                    return (
                      <div key={cat} className={`rounded-2xl border overflow-hidden ${colors.border}`}>
                        <div className={`px-4 py-2 flex items-center gap-2 ${colors.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>{t(`categories.${key}`)}</span>
                          <span className="ml-auto text-[9px] font-bold opacity-60">{items.length}</span>
                        </div>
                        {items.map((item, i) => (
                          <div key={i} className="flex flex-col border-t border-neutral-50 px-4 py-2 hover:bg-neutral-50 transition-colors group">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex-1 font-bold text-neutral-900 truncate">{item.name}</span>
                              {item.hasIncludedSide && <Layers className="w-3 h-3 text-indigo-500 shrink-0" title={t('parser.side_dish')} />}
                              {item.tags?.includes('autobox') && <Package className="w-3 h-3 text-amber-500 shrink-0" title={t('parser.auto_box')} />}
                              <span className="font-mono font-black text-neutral-800 shrink-0">{item.price.toFixed(2)}€</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => {
                                    if (renameItem?.name === item.name) setRenameItem(null);
                                    else setRenameItem({ name: item.name, newName: item.name });
                                    setRemapItem(null);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-blue-500 rounded"
                                  title={t('parser.rename_item')}
                                >
                                  📝
                                </button>
                                <button
                                  onClick={() => {
                                    setRemapItem(remapItem === item.name ? null : item.name);
                                    setRenameItem(null);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-indigo-600 rounded"
                                  title={t('parser.remap_desc')}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => addRemoveItemRule(item.name)}
                                  className="p-1 text-neutral-400 hover:text-red-500 rounded"
                                  title={t('menu.remove')}
                                >
                                  ❌
                                </button>
                              </div>
                            </div>
                            
                            <AnimatePresence>
                              {remapItem === item.name && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }} 
                                  animate={{ height: 'auto', opacity: 1 }} 
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 pt-2 border-t border-neutral-100 flex flex-wrap gap-1.5 pb-1">
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase mr-1 flex items-center">{t('parser.remap_to')}</span>
                                    {Object.entries(MENU_CONFIG.categoryLabels).map(([optKey, optLabel]) => (
                                      <button
                                        key={optKey}
                                        onClick={() => addCategoryOverrideRule(item.name, optLabel)}
                                        className="px-2 py-1 text-[9px] font-bold bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                                      >
                                        {optLabel}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                              
                              {renameItem?.name === item.name && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }} 
                                  animate={{ height: 'auto', opacity: 1 }} 
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-2 pb-1">
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase">{t('parser.rename_to')}</span>
                                    <input
                                      type="text"
                                      value={renameItem.newName}
                                      onChange={e => setRenameItem({ ...renameItem, newName: e.target.value })}
                                      className="flex-1 bg-white border border-neutral-200 text-xs font-bold text-neutral-900 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                                      autoFocus
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') addNameOverrideRule(item.name, renameItem.newName);
                                        if (e.key === 'Escape') setRenameItem(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => addNameOverrideRule(item.name, renameItem.newName)}
                                      className="px-2 py-1 bg-neutral-900 text-white rounded text-[10px] font-bold hover:bg-neutral-800"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  
                  {/* Save final preview as preset */}
                  {activePresetId && (
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-indigo-900">{t('parser.preset_rules_applied')}</h4>
                        <p className="text-[10px] text-indigo-600">{t('parser.editing_active')}</p>
                      </div>
                      <button
                        onClick={duplicateActivePresetAsNew}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                      >
                        {t('parser.save_new_preset')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ PHASE B: Unmatched Line Classifier ══ */}
      <AnimatePresence>
        {parseResult && parseResult.unmatchedLines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-red-50 bg-red-50/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900">
                    {t('parser.unmatched_lines')} <span className="font-mono text-red-500">({parseResult.unmatchedLines.length})</span>
                  </h2>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{t('parser.classify_desc')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {parseResult.unmatchedLines.map((line, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-2xl">
                    <code className="flex-1 text-xs font-mono text-red-800 truncate">{line}</code>
                    <button
                      onClick={() => setClassify({ line, index: idx, action: 'category', inputValue: '' })}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-[10px] font-bold hover:bg-blue-100 transition-colors"
                    >
                      <FolderOpen className="w-3 h-3" /> {t('menu.category')}
                    </button>
                    <button
                      onClick={() => setClassify({ line, index: idx, action: 'item', inputValue: '' })}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[10px] font-bold hover:bg-green-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> {t('parser.item_noun')}
                    </button>
                    <button
                      onClick={() => setClassify({ line, index: idx, action: 'ignore', inputValue: '' })}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 text-neutral-600 rounded-xl text-[10px] font-bold hover:bg-neutral-100 transition-colors"
                    >
                      <X className="w-3 h-3" /> {t('parser.ignore')}
                    </button>
                  </div>

                  {/* Inline classifier form */}
                  <AnimatePresence>
                    {classify?.index === idx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-4 bg-white border border-neutral-200 rounded-2xl flex items-center gap-3">
                          {classify.action === 'category' && (
                            <>
                              <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                              <span className="text-xs text-neutral-500 shrink-0">{t('parser.map_keyword')}</span>
                              <input
                                autoFocus
                                value={classify.inputValue}
                                onChange={e => setClassify(c => c ? { ...c, inputValue: e.target.value } : c)}
                                placeholder="e.g. Основно ястие"
                                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-400"
                              />
                            </>
                          )}
                          {classify.action === 'item' && (
                            <>
                              <Plus className="w-4 h-4 text-green-500 shrink-0" />
                              <span className="text-xs text-neutral-500 shrink-0">{t('parser.prepend_dash')}</span>
                              <code className="flex-1 text-xs font-mono text-green-700 bg-green-50 px-2 py-1 rounded-lg truncate">{classify.line}</code>
                            </>
                          )}
                          {classify.action === 'ignore' && (
                            <>
                              <X className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-xs text-neutral-500 shrink-0">{t('parser.remove_line_confirm')}</span>
                              <code className="flex-1 text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded-lg truncate">{classify.line}</code>
                            </>
                          )}
                          <button
                            onClick={applyClassify}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-bold hover:bg-neutral-800 transition-all"
                          >
                            <Check className="w-3 h-3" /> {t('parser.save_rule')}
                          </button>
                          <button
                            onClick={() => setClassify(null)}
                            className="shrink-0 p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ SECTION 3: Format Presets ══ */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900">{t('parser.presets')}</h2>
              <p className="text-[10px] text-neutral-400 mt-0.5">{t('parser.presets_desc')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* New preset */}
          <div className="flex gap-2">
            <input
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createPreset()}
              placeholder="New preset name… (e.g. «Restaurant Format 2»)"
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-neutral-400"
            />
            <button
              onClick={createPreset}
              disabled={!newPresetName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> {t('parser.create')}
            </button>
          </div>

          {presets.length === 0 && (
            <div className="py-8 text-center text-neutral-300">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold">{t('parser.no_presets_yet')}</p>
              <p className="text-[10px] mt-1">{t('parser.auto_build_tip')}</p>
            </div>
          )}

          {presets.map(preset => (
            <div
              key={preset.id}
              className={`p-4 rounded-2xl border transition-all ${
                activePresetId === preset.id
                  ? 'border-violet-300 bg-violet-50 shadow-md'
                  : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {activePresetId === preset.id && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full border border-violet-200">{t('parser.active')}</span>
                  )}
                  <span className="text-sm font-bold text-neutral-900">{preset.name}</span>
                  <span className="text-[10px] text-neutral-400">{preset.preprocessRules.length} rule{preset.preprocessRules.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-[10px] font-bold hover:bg-neutral-800 transition-all"
                  >
                    <Play className="w-2.5 h-2.5" /> {t('parser.apply_parse')}
                  </button>
                  <button
                    onClick={() => setActivePresetId(activePresetId === preset.id ? null : preset.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-[10px] font-bold hover:bg-neutral-50 transition-all"
                  >
                    {activePresetId === preset.id ? t('parser.deactivate') : t('parser.activate')}
                  </button>
                  <button
                    onClick={() => confirm({ title: t('parser.delete_preset'), message: `${t('modals.delete_warning')} "${preset.name}"?`, isDestructive: true, onConfirm: () => deletePreset(preset.id) })}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {preset.preprocessRules.length > 0 && (
                <div className="space-y-1 mt-3">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase">{t('parser.text_rules')}</p>
                  {preset.preprocessRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                      <code className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 rounded truncate max-w-[35%]">{rule.find || '(empty)'}</code>
                      <span className="text-neutral-400">→</span>
                      <code className="px-2 py-0.5 bg-green-50 border border-green-100 text-green-700 rounded truncate max-w-[35%]">{rule.replace || '(remove)'}</code>
                      {rule.isRegex && <span className="text-violet-500 font-bold px-1">{t('parser.regex_label')}</span>}
                    </div>
                  ))}
                </div>
              )}
              {preset.itemCategoryOverrides && Object.keys(preset.itemCategoryOverrides).length > 0 && (
                <div className="space-y-1 mt-3">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase">{t('parser.item_remaps')}</p>
                  {Object.entries(preset.itemCategoryOverrides).map(([itemName, targetCat], i) => (
                    <div key={`remap-${i}`} className="flex items-center gap-2 text-[10px] font-mono">
                      <code className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded truncate max-w-[40%] text-xs font-bold">{itemName}</code>
                      <span className="text-neutral-400">→</span>
                      <code className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] uppercase tracking-widest font-black">{targetCat}</code>
                    </div>
                  ))}
                </div>
              )}
              
              {preset.itemNameOverrides && Object.keys(preset.itemNameOverrides).length > 0 && (
                <div className="space-y-1 mt-3">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase">{t('parser.item_renames')}</p>
                  {Object.entries(preset.itemNameOverrides).map(([originalName, newName], i) => (
                    <div key={`rename-${i}`} className="flex items-center gap-2 text-[10px] font-mono">
                      <code className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-600 rounded truncate max-w-[40%] text-xs line-through">{originalName}</code>
                      <span className="text-neutral-400">→</span>
                      <code className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded text-xs font-bold">{newName}</code>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Rule Addition */}
              {manualRulePreset === preset.id ? (
                <div className="mt-4 p-3 bg-white border border-neutral-200 rounded-xl flex items-center gap-2">
                  <input
                    value={manualRuleFind}
                    onChange={e => setManualRuleFind(e.target.value)}
                    placeholder={t('parser.find_text')}
                    className="flex-1 bg-neutral-50 px-2.5 py-1.5 text-xs rounded border border-neutral-200 focus:outline-none"
                  />
                  <input
                    value={manualRuleReplace}
                    onChange={e => setManualRuleReplace(e.target.value)}
                    placeholder={t('parser.replace_with_placeholder')}
                    className="flex-1 bg-neutral-50 px-2.5 py-1.5 text-xs rounded border border-neutral-200 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!manualRuleFind.trim()) return;
                      // We change the active preset temporarily or just inject directly into localStorage.
                      // The simplest way is to call a function. Let's do it directly.
                      setPresets(prev => {
                        let updated = [...prev];
                        const idx = updated.findIndex(p => p.id === preset.id);
                        if (idx >= 0) {
                          updated[idx].preprocessRules.push({ find: manualRuleFind, replace: manualRuleReplace, isRegex: false });
                        }
                        localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
                        return updated;
                      });
                      setManualRulePreset(null);
                    }}
                    className="px-3 py-1.5 bg-neutral-900 text-white rounded text-xs font-bold hover:bg-neutral-800"
                  >
                    {t('parser.save_rule')}
                  </button>
                  <button onClick={() => setManualRulePreset(null)} className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    onClick={() => { setManualRulePreset(preset.id); setManualRuleFind(''); setManualRuleReplace(''); }}
                    className="text-[10px] font-bold text-neutral-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                  >
                    + Add Manual Rule
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
