import React from 'react';
import { EntityExtractionRules } from '../../../../types/parserConfig';
import { RuleField } from './RuleField';
import { FileJson, ListFilter, Scissors, CreditCard, Crosshair } from 'lucide-react';

interface EntityExtractionEditorProps {
  rules: EntityExtractionRules;
  onChange: (rules: EntityExtractionRules) => void;
  t: (key: string) => string;
}

export const EntityExtractionEditor: React.FC<EntityExtractionEditorProps> = ({ rules, onChange, t }) => {
  const updateRule = (key: keyof EntityExtractionRules, val: string) => {
    onChange({ ...rules, [key]: val });
  };

  return (
    <div className="space-y-8">
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tighter text-neutral-900">{t('parser.entity_extraction')}</h4>
          <p className="text-[10px] text-neutral-400">{t('parser.entity_extraction_desc')}</p>
        </div>
        <div className="flex gap-2">
           <div className="w-8 h-8 rounded-full bg-neutral-200/50 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-neutral-400" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <SectionHeader icon={CreditCard} title={t('parser.primary_entities')} />
          <RuleField 
            label={t('parser.price_pattern')}
            value={rules.pricePattern}
            onChange={(v) => updateRule('pricePattern', v)}
            placeholder="e.g. ([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$)"
            description={t('parser.price_pattern_desc')}
            t={t}
          />
          <RuleField 
            label={t('parser.weight_pattern')}
            value={rules.weightPattern}
            onChange={(v) => updateRule('weightPattern', v)}
            placeholder="e.g. (\d+\s*(?:гр|g|gr|мл|ml))"
            description={t('parser.weight_pattern_desc')}
            t={t}
          />
          <RuleField 
            label={t('parser.date_pattern')}
            value={rules.datePattern}
            onChange={(v) => updateRule('datePattern', v)}
            placeholder="e.g. (\d{1,2}[.\-/\d]{2,10})"
            t={t}
          />
        </div>

        <div className="space-y-6">
          <SectionHeader icon={Scissors} title={t('parser.id_noise')} />
          <RuleField 
            label={t('parser.item_prefix')}
            value={rules.itemPrefixPattern}
            onChange={(v) => updateRule('itemPrefixPattern', v)}
            placeholder="^[-•*]\s*"
            description={t('parser.item_prefix_desc')}
            t={t}
          />
          <RuleField 
            label={t('parser.box_fee_extract')}
            value={rules.boxFeePattern}
            onChange={(v) => updateRule('boxFeePattern', v)}
            placeholder="([\d]+[,.][\d]+)\s*кутийка"
            t={t}
          />
          <RuleField 
            label={t('parser.bgn_noise')}
            value={rules.bgnNoisePattern || ''}
            onChange={(v) => updateRule('bgnNoisePattern', v)}
            placeholder="e.g. [\d]+[,.][\d]+\s*(?:лв|лева)"
            description={t('parser.bgn_noise_desc')}
            t={t}
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
