import React from 'react';
import { Order, PersistedOrderItem } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { formatDate } from '../../../utils/dateFormatter';
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
import { TabHeader } from '../../shared/TabHeader';

interface Filters {
  startDate: string;
  endDate: string;
  /** Matched against both the RFID and the owner's name by /api/history. */
  rfid: string;
}

interface HistoryTabProps {
  history: Order[];
  /** The server capped the result, so the figures below cover only what is shown. */
  truncated?: boolean;
  loading?: boolean;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onApplyFilters: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  truncated = false,
  loading = false,
  filters,
  onFilterChange,
  onApplyFilters,
}) => {
  const { t } = useTranslation();
  const setShowHistoryReport = useStore(s => s.setShowHistoryReport);

  const columns: DataListColumn[] = [
    { key: 'when', label: t('orders.timestamp') || '', role: 'title' },
    { key: 'who', label: t('orders.cardholder') || '' },
    { key: 'items', label: t('orders.items') || '' },
    { key: 'total', label: t('orders.total') || '', align: 'right' },
  ];

  const rows: DataListRow[] = (Array.isArray(history) ? history : []).map((order) => {
    const items: PersistedOrderItem[] = order.items;

    return {
      key: order.id,
      cells: {
        when: (
          <>
            <p className="font-bold text-neutral-900">{formatDate(order.timestamp)}</p>
            <p className="text-[10px] text-neutral-400 font-mono">
              {new Date(order.timestamp).toLocaleTimeString()}
            </p>
          </>
        ),
        who: (
          <>
            <p className="font-bold text-neutral-900">{order.ownerName ?? t('menu.unknown_user')}</p>
            <p className="text-[10px] text-neutral-400 font-mono">{order.rfid ?? 'N/A'}</p>
          </>
        ),
        items: (
          <div className="space-y-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
            {Array.isArray(items) ? (
              items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4 text-xs">
                  <span className="font-bold text-neutral-900 truncate">{item.name}</span>
                  <span className="text-neutral-400 font-mono">x{item.quantity || 1}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-400 italic">{t('menu.no_items')}</p>
            )}
          </div>
        ),
        total: (
          <span className="font-mono font-bold text-neutral-900">
            €{(Number(order.totalPrice) || 0).toFixed(2)}
          </span>
        ),
      },
    };
  });

  return (
    <>
      <TabHeader
        title={t('navigation.history')}
        subtitle={t('menu.history_desc')}
      />

      {truncated && (
        <div className="flex items-start gap-3 mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            {t('analytics.history_truncated')}
          </p>
        </div>
      )}

      {/* Summary Bar */}
      {Array.isArray(history) && history.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900 p-4 rounded-2xl text-white shadow-lg">
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-1">{t('analytics.result_count')}</p>
            <p className="text-xl font-bold">{history.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">{t('analytics.total_spending')}</p>
            <p className="text-xl font-bold text-neutral-900">
              €{history.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">{t('analytics.avg_transaction')}</p>
            <p className="text-xl font-bold text-neutral-900">
              €{(history.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0) / history.length).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">{t('analytics.unique_users')}</p>
            <p className="text-xl font-bold text-neutral-900">
              {new Set(history.map(o => o.rfid)).size}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              {t('filters.start_date')}
            </label>
            <input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              {t('filters.end_date')}
            </label>
            <input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rfidSearch" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              RFID / {t('cards.owner_name')}
            </label>
            <input
              id="rfidSearch"
              type="text"
              value={filters.rfid}
              onChange={(e) => onFilterChange('rfid', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
              placeholder={t('filters.search_placeholder')}
              className="w-full px-4 py-2.5 touch-target-h bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onApplyFilters}
              disabled={loading}
              className="w-full py-2.5 touch-target-h bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all text-sm shadow-lg shadow-neutral-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('filters.apply')}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowHistoryReport(true)}
              disabled={!history || history.length === 0}
              className="w-full py-2.5 touch-target-h bg-white text-neutral-900 border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition-all text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              {t('analytics.summary_report')}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
        <DataList
          columns={columns}
          rows={rows}
          emptyMessage={t('menu.no_history') || ''}
          tableClassName="min-w-[600px]"
        />
      </div>
    </>
  );
};
