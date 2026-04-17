import React from 'react';
import { Order } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';

interface Filters {
  startDate: string;
  endDate: string;
  rfid: string;
  ownerName: string;
}

interface HistoryTabProps {
  history: Order[];
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onApplyFilters: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  filters,
  onFilterChange,
  onApplyFilters,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.history')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">
            {t('menu.history_desc')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              {t('filters.start_date')}
            </label>
            <input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
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
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rfidSearch" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">
              {t('cards.rfid')} / {t('cards.owner_name')}
            </label>
            <input
              id="rfidSearch"
              type="text"
              value={filters.rfid}
              onChange={(e) => onFilterChange('rfid', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
              placeholder={t('filters.search_placeholder')}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onApplyFilters}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all text-sm"
            >
              {t('filters.apply')}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                {[t('orders.timestamp'), t('orders.cardholder'), t('orders.items'), t('orders.total')].map((h, i) => (
                  <th
                    key={h}
                    className={`p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 ${i === 3 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {Array.isArray(history) && history.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="p-6">
                    <p className="font-bold text-neutral-900">{new Date(order.timestamp).toLocaleDateString()}</p>
                    <p className="text-[10px] text-neutral-400 font-mono">{new Date(order.timestamp).toLocaleTimeString()}</p>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-neutral-900">{order.ownerName ?? t('menu.unknown_user')}</p>
                    <p className="text-[10px] text-neutral-400 font-mono">{order.rfid ?? 'N/A'}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-xs text-neutral-600 max-w-[260px] truncate">
                      {Array.isArray(order.items) ? order.items.map((i) => i.name).join(', ') : t('menu.no_items')}
                    </p>
                  </td>
                  <td className="p-6 text-right font-mono font-bold text-neutral-900">
                    €{(Number(order.totalPrice) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {(!Array.isArray(history) || history.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-neutral-400 italic text-sm">
                    {t('menu.no_history')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
