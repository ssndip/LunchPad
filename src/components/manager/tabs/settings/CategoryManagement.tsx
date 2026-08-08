import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, Plus, Trash2, Globe, Check, AlertCircle, Edit2 } from 'lucide-react';
import { CustomCategory } from '../../../../types';

interface CategoryManagementProps {
  categories: CustomCategory[];
  systemLanguages: { code: string; name: string }[];
  onUpdate: (categories: CustomCategory[]) => void;
  t: (key: string) => string;
}

export const CategoryManagement: React.FC<CategoryManagementProps> = ({
  categories,
  systemLanguages,
  onUpdate,
  t,
}) => {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomCategory | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  const handleEdit = (cat: CustomCategory) => {
    setEditingCatId(cat.id);
    setEditForm({ ...cat, keywords: [...cat.keywords], names: { ...cat.names } });
  };

  const handleCreate = () => {
    const newId = 'cat_' + Date.now();
    setEditingCatId(newId);
    setEditForm({
      id: newId,
      names: {},
      keywords: [],
    });
  };

  const handleSave = () => {
    if (!editForm) return;
    
    // Ensure it has at least a fallback name
    if (Object.keys(editForm.names).length === 0) {
      editForm.names['en'] = 'New Category';
    }

    const exists = categories.find(c => c.id === editForm.id);
    let newCats;
    if (exists) {
      newCats = categories.map(c => c.id === editForm.id ? editForm : c);
    } else {
      newCats = [...categories, editForm];
    }
    
    onUpdate(newCats);
    setEditingCatId(null);
    setEditForm(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this category? Menu items assigned to it may fall back to 'Other'.")) {
      onUpdate(categories.filter(c => c.id !== id));
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && editForm && !editForm.keywords.includes(newKeyword.trim())) {
      setEditForm({ ...editForm, keywords: [...editForm.keywords, newKeyword.trim()] });
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    if (editForm) {
      setEditForm({ ...editForm, keywords: editForm.keywords.filter(k => k !== kw) });
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 lg:p-8 shadow-sm border border-neutral-100 mb-8 overflow-hidden relative group">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white transition-all shadow-inner">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">Dynamic Categories</h3>
            <p className="text-sm text-neutral-500 font-medium mt-1">Manage AI parsing categories and multi-language names</p>
          </div>
        </div>
        {!editingCatId && (
          <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-md hover:bg-neutral-800 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {editingCatId && editForm ? (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-neutral-50 p-6 rounded-[24px] border border-neutral-200"
          >
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-neutral-900">
                {categories.some(c => c.id === editForm.id) ? 'Edit Category' : 'New Category'}
              </h4>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-neutral-400 mb-3">Translations</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {systemLanguages.map(lang => (
                    <div key={lang.code} className="flex flex-col gap-1">
                      <span className="text-[10px] text-neutral-500 font-bold ml-1">{lang.name} ({lang.code.toUpperCase()})</span>
                      <input
                        type="text"
                        value={editForm.names[lang.code] || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          names: { ...editForm.names, [lang.code]: e.target.value }
                        })}
                        placeholder={`Name in ${lang.name}`}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-neutral-900 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-neutral-400 mb-3">Parsing Keywords (Lower Case)</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                    placeholder="e.g. 'супа' or 'soup'"
                    className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-neutral-900 outline-none"
                  />
                  <button onClick={addKeyword} className="px-4 bg-neutral-200 text-neutral-700 rounded-xl font-bold hover:bg-neutral-300">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editForm.keywords.map(kw => (
                    <span key={kw} className="px-3 py-1 bg-white border border-neutral-200 rounded-full text-xs font-bold text-neutral-600 flex items-center gap-2 shadow-sm">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} title={`${t('modals.remove')} ${kw}`} aria-label={`${t('modals.remove')} ${kw}`} className="hover:text-red-500"><XIcon /></button>
                    </span>
                  ))}
                  {editForm.keywords.length === 0 && <span className="text-xs text-neutral-400 italic">No keywords. AI might miss this.</span>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 mt-6">
                <button 
                  onClick={() => { setEditingCatId(null); setEditForm(null); }}
                  className="px-6 py-3 rounded-xl bg-neutral-200 hover:bg-neutral-300 font-bold text-sm text-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 font-bold text-sm text-white transition-all shadow-md"
                >
                  Save Category
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {categories.map(cat => (
              <div key={cat.id} className="bg-neutral-50 border border-neutral-100 rounded-2xl p-5 hover:border-neutral-300 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-neutral-900 text-lg">
                    {cat.names['en'] || cat.names['bg'] || Object.values(cat.names)[0] || 'Unnamed'}
                  </h4>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(cat)} title={`${t('modals.edit')} ${t('menu.category').toLowerCase()} ${cat.names['en'] || cat.id}`} aria-label={`${t('modals.edit')} ${t('menu.category').toLowerCase()} ${cat.names['en'] || cat.id}`} className="text-neutral-400 hover:text-indigo-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(cat.id)} title={`${t('modals.remove')} ${t('menu.category').toLowerCase()} ${cat.names['en'] || cat.id}`} aria-label={`${t('modals.remove')} ${t('menu.category').toLowerCase()} ${cat.names['en'] || cat.id}`} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Translations</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(cat.names).map(([lang, name]) => (
                        <span key={lang} className="text-[10px] px-2 py-0.5 bg-white border border-neutral-200 rounded text-neutral-600">
                          <span className="font-bold mr-1">{lang.toUpperCase()}:</span> {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Keywords</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cat.keywords.slice(0, 3).map(k => (
                        <span key={k} className="text-[10px] px-2 py-0.5 bg-neutral-200 rounded-full text-neutral-600 font-medium">
                          {k}
                        </span>
                      ))}
                      {cat.keywords.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 text-neutral-400 font-medium">+{cat.keywords.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
