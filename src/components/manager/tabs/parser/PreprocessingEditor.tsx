import React from 'react';
import { PreprocessingRule } from '../../../../types/parserConfig';
import { Plus, Trash2, Scissors, RefreshCw, Type, AlignLeft } from 'lucide-react';
import { RuleField } from './RuleField';

interface PreprocessingEditorProps {
  rules: PreprocessingRule[];
  onChange: (rules: PreprocessingRule[]) => void;
}

export const PreprocessingEditor: React.FC<PreprocessingEditorProps> = ({ rules, onChange }) => {
  const addRule = () => {
    const newRule: PreprocessingRule = {
      id: `pre-${Date.now()}`,
      type: 'replace',
      pattern: '',
      replace: ''
    };
    onChange([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<PreprocessingRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex justify-between items-center">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tighter text-neutral-900">Text Preprocessing</h4>
          <p className="text-[10px] text-neutral-400">Standardize menu text before it enters the parsing stages.</p>
        </div>
        <button 
          onClick={addRule}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-md"
        >
          <Plus className="w-3 h-3" /> Add Step
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="p-4 bg-white border border-neutral-100 rounded-xl flex flex-col md:flex-row gap-4 items-center group shadow-sm">
            <div className="flex items-center gap-3 md:w-48">
               <div className="p-2 bg-neutral-100 rounded-lg">
                  {rule.type === 'replace' && <RefreshCw className="w-4 h-4 text-neutral-500" />}
                  {rule.type === 'trim' && <Scissors className="w-4 h-4 text-neutral-500" />}
                  {rule.type === 'normalize_whitespace' && <AlignLeft className="w-4 h-4 text-neutral-500" />}
               </div>
               <select 
                  value={rule.type}
                  onChange={(e) => updateRule(rule.id, { type: e.target.value as any })}
                  className="bg-transparent text-xs font-black uppercase tracking-widest text-neutral-900 focus:outline-none"
               >
                  <option value="replace">Replace</option>
                  <option value="trim">Trim Global</option>
                  <option value="normalize_whitespace">Clean Spaces</option>
                  <option value="remove">Remove</option>
               </select>
            </div>

            {rule.type === 'replace' && (
               <>
                  <div className="flex-1 w-full">
                     <RuleField 
                        label="Search (Regex)"
                        value={rule.pattern || ''}
                        onChange={(v) => updateRule(rule.id, { pattern: v })}
                        placeholder="e.g. \[\w+\]"
                     />
                  </div>
                  <div className="flex-1 w-full">
                     <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">Replace With</label>
                     <input 
                        type="text"
                        value={rule.replace || ''}
                        onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-900"
                        placeholder="leave empty to delete"
                     />
                  </div>
               </>
            )}

            {(rule.type === 'trim' || rule.type === 'normalize_whitespace') && (
               <p className="flex-1 text-[11px] text-neutral-400 italic">
                  This rule will be applied automatically across the entire raw text input.
               </p>
            )}

            <button 
               onClick={() => removeRule(rule.id)}
               className="p-2 text-neutral-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
            >
               <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
