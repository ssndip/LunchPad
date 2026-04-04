import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { DailySummary } from '../../../types';

interface OrdersTabProps {
  summaries: DailySummary[];
  expandedDate: string | null;
  dailyDetails: Array<{ category: string; name: string; quantity: number; price: number; total: number }>;
  onExpandDate: (date: string) => void;
  onCopySummary: (date: string, total: number) => void;
  onResetHistory: () => void;
  t: (key: string) => string;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  summaries,
  expandedDate,
  dailyDetails,
  onExpandDate,
  onCopySummary,
  onResetHistory,
  t,
}) => {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.order_summary')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">
            {t('orders.performance_subtitle')}
          </p>
        </div>
        {summaries.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm(t('modals.reset_history_warning'))) {
                onResetHistory();
              }
            }}
            tabIndex={-1}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all text-sm shadow-lg shadow-red-100 active:scale-95"
          >
            <Trash2 className="w-4 h-4" /> {t('menu.delete_all') || 'Reset History'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr>
                <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100">{t('orders.date')}</th>
                <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-center border-b border-neutral-100">{t('navigation.order_summary')}</th>
                <th className="p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 text-right border-b border-neutral-100">{t('orders.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {Array.isArray(summaries) && summaries.map((summary) => (
                <React.Fragment key={summary.date}>
                  <tr
                    onClick={() => onExpandDate(summary.date)}
                    className={`transition-colors cursor-pointer group ${expandedDate === summary.date ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                  >
                    <td className="p-6 font-bold text-neutral-900">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${expandedDate === summary.date ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'}`}>
                          <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${expandedDate === summary.date ? 'rotate-90' : ''}`} />
                        </div>
                        <span>{summary.date ?? 'Unknown Date'}</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="px-4 py-1.5 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900 group-hover:bg-neutral-200 transition-colors">
                        {Number(summary.orderCount) || 0}
                      </span>
                    </td>
                    <td className="p-6 text-right font-mono font-bold text-neutral-900">
                      €{(Number(summary.totalSales) || 0).toFixed(2)}
                    </td>
                  </tr>

                  {expandedDate === summary.date && (
                    <tr>
                      <td colSpan={3} className="p-0 bg-neutral-50 border-b border-neutral-100">
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-8"
                        >
                          <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-6 bg-neutral-900 rounded-full" />
                              <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">
                                {t('orders.items_breakdown')}
                              </h3>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onCopySummary(summary.date, summary.totalSales); }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-lg active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" /> {t('orders.copy_summary')}
                            </button>
                          </div>

                          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xl">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="bg-neutral-50/50 border-b border-neutral-100">
                                  <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{t('menu.category')} / {t('menu.name')}</th>
                                  <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-center">{t('orders.quantity')}</th>
                                  <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-right">{t('menu.price')}</th>
                                  <th className="p-5 font-mono text-[10px] uppercase tracking-widest text-neutral-400 text-right">{t('orders.total')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-50">
                                {Array.isArray(dailyDetails) && dailyDetails.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-5">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">{item.category ?? 'Uncategorized'}</p>
                                      <p className="font-bold text-neutral-900">{item.name ?? 'Unknown Item'}</p>
                                    </td>
                                    <td className="p-5 text-center">
                                      <span className="bg-neutral-100 px-3 py-1 rounded-lg font-mono font-black text-neutral-900">
                                        {Number(item.quantity) || 0}
                                      </span>
                                    </td>
                                    <td className="p-5 text-right font-mono text-neutral-500">€{(Number(item.price) || 0).toFixed(2)}</td>
                                    <td className="p-5 text-right font-mono font-bold text-neutral-900">€{(Number(item.total) || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-neutral-900 text-white">
                                  <td colSpan={3} className="p-5 font-bold uppercase tracking-widest text-xs text-right">{t('orders.total')}</td>
                                  <td className="p-5 text-right font-mono font-black text-lg">€{summary.totalSales.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {(!Array.isArray(summaries) || summaries.length === 0) && (
                <tr><td colSpan={3} className="p-12 text-center text-neutral-400 italic">{t('orders.no_orders')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
