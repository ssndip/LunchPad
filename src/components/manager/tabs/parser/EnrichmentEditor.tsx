import React from 'react';
import { EnrichmentRule } from '../../../../types/parserConfig';
import { Plus, Trash2, Tag, Zap, Filter, CheckCircle } from 'lucide-react';

interface EnrichmentEditorProps {
  rules: EnrichmentRule[];
  onChange: (rules: EnrichmentRule[]) => void;
  t: (key: string) => string;
}

export const EnrichmentEditor: React.FC<EnrichmentEditorProps> = ({ rules, onChange, t }) => {
  const addRule = () => {
    const newRule: EnrichmentRule = {
      id: `rule-${Date.now()}`,
      condition: { category: [] },
      action: { addTag: 'new-tag' }
    };
    onChange([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<EnrichmentRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex justify-between items-center">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tighter text-neutral-900">{t('parser.enrichment_rules')}</h4>
          <p className="text-[10px] text-neutral-400">{t('parser.enrichment_desc')}</p>
        </div>
        <button 
          onClick={addRule}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-md"
        >
          <Plus className="w-3 h-3" /> {t('parser.add_rule')}
        </button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm group hover:border-neutral-200 transition-all">
            <div className="flex flex-col md:flex-row gap-8 items-start">
               {/* Condition Section */}
               <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center gap-2 mb-2">
                     <Filter className="w-4 h-4 text-neutral-400" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">{t('parser.condition')}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">{t('parser.categories_comma')}</label>
                        <input 
                           type="text"
                           value={rule.condition.category?.join(', ') || ''}
                           onChange={(e) => updateRule(rule.id, { 
                             condition: { ...rule.condition, category: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                           })}
                           className="w-full px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-lg text-xs"
                           placeholder="e.g. Side Dishes, Salads"
                        />
                     </div>
                     <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">{t('parser.name_contains')}</label>
                        <input 
                           type="text"
                           value={rule.condition.nameContains || ''}
                           onChange={(e) => updateRule(rule.id, { 
                             condition: { ...rule.condition, nameContains: e.target.value } 
                           })}
                           className="w-full px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-lg text-xs"
                           placeholder="e.g. bbq mix"
                        />
                     </div>
                  </div>
               </div>

               {/* Action Section */}
               <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center gap-2 mb-2">
                     <Zap className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">{t('parser.action')}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">{t('parser.add_tag')}</label>
                        <div className="relative">
                           <Tag className="absolute left-2.5 top-2.5 w-3 h-3 text-neutral-400" />
                           <input 
                              type="text"
                              value={rule.action.addTag || ''}
                              onChange={(e) => updateRule(rule.id, { 
                                action: { ...rule.action, addTag: e.target.value } 
                              })}
                              className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-100 rounded-lg text-xs font-bold"
                              placeholder="e.g. autobox"
                           />
                        </div>
                     </div>
                     <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">{t('parser.set_box_fee')}</label>
                        <input 
                           type="number"
                           step="0.01"
                           value={rule.action.setBoxFee ?? ''}
                           onChange={(e) => updateRule(rule.id, { 
                             action: { ...rule.action, setBoxFee: e.target.value ? parseFloat(e.target.value) : undefined } 
                           })}
                           className="w-full px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-lg text-xs"
                           placeholder="e.g. 0.30"
                        />
                     </div>
                  </div>
                  
                  <div className="pt-2 flex items-center gap-2">
                     <button 
                       onClick={() => updateRule(rule.id, { action: { ...rule.action, hasIncludedSide: !rule.action.hasIncludedSide }})}
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                         rule.action.hasIncludedSide 
                           ? 'bg-green-500 border-green-500 text-white' 
                           : 'bg-white border-neutral-100 text-neutral-400'
                       }`}
                     >
                        <CheckCircle className="w-3 h-3" /> {t('parser.inc_side_choice')}
                     </button>
                  </div>
               </div>
               
               <button 
                  onClick={() => removeRule(rule.id)}
                  className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all self-end md:self-start"
               >
                  <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
