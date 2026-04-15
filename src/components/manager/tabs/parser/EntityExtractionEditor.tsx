import React from 'react';
import { EntityExtractionRules } from '../../../../types/parserConfig';
import { RuleField } from './RuleField';
import { FileJson, ListFilter, Scissors, CreditCard, Crosshair } from 'lucide-react';

interface EntityExtractionEditorProps {
  rules: EntityExtractionRules;
  onChange: (rules: EntityExtractionRules) => void;
}

export const EntityExtractionEditor: React.FC<EntityExtractionEditorProps> = ({ rules, onChange }) => {
  const updateRule = (key: keyof EntityExtractionRules, val: string) => {
    onChange({ ...rules, [key]: val });
  };

  return (
    <div className="space-y-8">
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tighter text-neutral-900">Entity Extraction</h4>
          <p className="text-[10px] text-neutral-400">Regex patterns for identifying specific data points inside lines.</p>
        </div>
        <div className="flex gap-2">
           <div className="w-8 h-8 rounded-full bg-neutral-200/50 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-neutral-400" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <SectionHeader icon={CreditCard} title="Primary Entities" />
          <RuleField 
            label="Price Pattern"
            value={rules.pricePattern}
            onChange={(v) => updateRule('pricePattern', v)}
            placeholder="e.g. ([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$)"
            description="Must include one capture group for the numeric value."
          />
          <RuleField 
            label="Weight Pattern"
            value={rules.weightPattern}
            onChange={(v) => updateRule('weightPattern', v)}
            placeholder="e.g. (\d+\s*(?:гр|g|gr|мл|ml))"
            description="Capture group 1 should be the weight string."
          />
          <RuleField 
            label="Date Pattern"
            value={rules.datePattern}
            onChange={(v) => updateRule('datePattern', v)}
            placeholder="e.g. (\d{1,2}[.\-/\d]{2,10})"
          />
        </div>

        <div className="space-y-6">
          <SectionHeader icon={Scissors} title="Identification & Noise" />
          <RuleField 
            label="Item Prefix"
            value={rules.itemPrefixPattern}
            onChange={(v) => updateRule('itemPrefixPattern', v)}
            placeholder="^[-•*]\s*"
            description="Lines matching this will be treated as menu items."
          />
          <RuleField 
            label="Box Fee Extract"
            value={rules.boxFeePattern}
            onChange={(v) => updateRule('boxFeePattern', v)}
            placeholder="([\d]+[,.][\d]+)\s*кутийка"
          />
          <RuleField 
            label="BGN Price Noise (Strip)"
            value={rules.bgnNoisePattern || ''}
            onChange={(v) => updateRule('bgnNoisePattern', v)}
            placeholder="e.g. [\d]+[,.][\d]+\s*(?:лв|лева)"
            description="Matches removed from name to avoid double prices."
          />
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <div className="flex items-center gap-2 pb-2 border-b border-neutral-50 mb-4">
    <Icon className="w-4 h-4 text-neutral-900" />
    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">{title}</span>
  </div>
);
