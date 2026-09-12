import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from '../../hooks/useTranslation';
import { Sheet } from './Sheet';

export interface TabHeaderAction {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isDestructive?: boolean;
  hidden?: boolean;
}

export interface TabHeaderProps {
  title: string;
  subtitle?: string;
  /** Always visible, at every width. */
  primaryAction?: TabHeaderAction;
  /** Inline above md; collapsed into a sheet below it. */
  secondaryActions?: TabHeaderAction[];
  /** Arbitrary controls — fee inputs, filters. Inline above md, in the sheet below. */
  controls?: React.ReactNode;
}

/**
 * A tab's title row.
 *
 * Above md everything renders inline, exactly as the tabs did by hand. Below
 * md only the title and one primary action stay on screen and the rest moves
 * into a sheet, because MenuTab's seven controls otherwise wrap into a column
 * taller than the content they act on.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryActions = [],
  controls,
}) => {
  const { isPhone } = useResponsive();
  const { t } = useTranslation();
  const [overflowOpen, setOverflowOpen] = React.useState(false);

  const actionsLabel = t('navigation.actions') || 'Actions';

  const visibleSecondary = secondaryActions.filter((a) => !a.hidden);
  const hasOverflow = isPhone && (visibleSecondary.length > 0 || !!controls);

  const renderButton = (action: TabHeaderAction, variant: 'primary' | 'secondary') => {
    const Icon = action.icon;
    return (
      <button
        key={action.key}
        onClick={action.onClick}
        className={`flex items-center gap-2 px-5 touch-target-h rounded-xl font-bold transition-all text-sm ${
          action.isDestructive
            ? 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
            : variant === 'primary'
              ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-200'
              : 'bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-50 shadow-sm'
        }`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        {action.label}
      </button>
    );
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-neutral-900">{title}</h1>
          {subtitle && <p className="text-neutral-500 text-sm md:text-base">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isPhone && controls}
          {!isPhone && visibleSecondary.map((a) => renderButton(a, 'secondary'))}
          {primaryAction && renderButton(primaryAction, 'primary')}
          {hasOverflow && (
            <button
              data-testid="tabheader-overflow"
              onClick={() => setOverflowOpen(true)}
              aria-label={actionsLabel}
              className="touch-target flex items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-600 shadow-sm active:scale-95 transition-transform"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <Sheet isOpen={overflowOpen} onClose={() => setOverflowOpen(false)} title={actionsLabel}>
        <div className="flex flex-col gap-3">
          {controls}
          {visibleSecondary.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => {
                  setOverflowOpen(false);
                  action.onClick();
                }}
                className={`w-full flex items-center gap-3 px-4 touch-target-h rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                  action.isDestructive ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                <span className="text-left">{action.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
};
