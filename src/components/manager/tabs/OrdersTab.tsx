import React from 'react';
import { motion } from 'motion/react';
import { DailySummary } from '../../../types';
import { useStore } from '../../../store/useStore';
import * as api from '../../../api';
import { Truck, CheckCircle2, ChevronRight, Plus } from 'lucide-react';

interface OrdersTabProps {
  summaries: DailySummary[];
  expandedDate: string | null;
  dailyDetails: Array<{ category: string; name: string; quantity: number; price: number; total: number }>;
  onExpandDate: (date: string) => void;
  onCopySummary: (date: string, total: number) => void;
  t: (key: string) => string;
  confirm: (config: any) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  summaries,
  expandedDate,
  dailyDetails,
  onExpandDate,
  onCopySummary,
  t,
  confirm,
}) => {
  const token = useStore(s => s.token);
  const globalDeliveryFee = useStore(s => s.deliveryFee);
  const [dailyFees, setDailyFees] = React.useState<Record<string, string>>({});
  const [distributing, setDistributing] = React.useState<string | null>(null);

  const handleDistributeFee = async (date: string, fee: number) => {
    if (!token) return;
    
    // Feature 10: Custom confirmation modal
    confirm({
      title: t('orders.distribute_fee'),
      message: t('orders.distribute_confirm').replace('{{fee}}', fee.toString()).replace('{{count}}', summaries.find(s => s.date === date)?.orderCount || '0'),
      onConfirm: async () => {
        setDistributing(date);
        try {
          const res = await api.distributeFee(token, date, fee);
          confirm({
            title: t('modals.confirm'),
            message: t('orders.distribute_success').replace('{{split}}', res.splitFee).replace('{{count}}', res.userCount),
            confirmText: 'OK',
            onConfirm: () => {}
          });
        } catch (err: any) {
          confirm({
            title: t('menu.Error'),
            message: err.message,
            isDestructive: true,
            confirmText: 'OK',
            onConfirm: () => {}
          });
        } finally {
          setDistributing(null);
        }
      }
    });
  };
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
                        <span>{summary.date ?? t('menu.unknown_date')}</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="px-4 py-1.5 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900 group-hover:bg-neutral-200 transition-colors">
                        {Number(summary.orderCount) || 0}
                      </span>
                    </td>
                    <td className="p-6 text-right font-mono font-bold text-neutral-900">
                      €{(Number(summary?.totalSales) || 0).toFixed(2)}
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
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 ml-1">
                                  {t('orders.delivery_fee')}
                                </label>
                                <div className="relative">
                                  <input 
                                    type="number"
                                    step="0.01"
                                    placeholder={t('orders.fee_placeholder')}
                                    value={dailyFees[summary.date] !== undefined ? dailyFees[summary.date] : globalDeliveryFee}
                                    onChange={(e) => setDailyFees({ ...dailyFees, [summary.date]: e.target.value })}
                                    className="w-full h-12 pl-4 pr-10 bg-white border border-neutral-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">€</span>
                                </div>
                              </div>

                              <div className="flex items-end gap-2 h-12 mt-auto">
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const fee = parseFloat(dailyFees[summary.date] || globalDeliveryFee.toString());
                                    handleDistributeFee(summary.date, fee); 
                                  }}
                                  disabled={!!distributing}
                                  className="h-full flex items-center gap-2 px-6 bg-indigo-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                >
                                  {distributing === summary.date ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                      <Truck className="w-3.5 h-3.5" />
                                    </motion.div>
                                  ) : (
                                    <Truck className="w-3.5 h-3.5" />
                                  )}
                                  {t('orders.distribute_fee')}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onCopySummary(summary.date, Number(summary.totalSales) || 0); }}
                                  className="h-full flex items-center gap-2 px-6 bg-neutral-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100 active:scale-95"
                                >
                                  <Plus className="w-3.5 h-3.5" /> {t('orders.copy_summary')}
                                </button>
                              </div>
                            </div>
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
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">{item.category ?? t('menu.uncategorized')}</p>
                                      <p className="font-bold text-neutral-900">{item.name ?? t('menu.unknown_item')}</p>
                                    </td>
                                    <td className="p-5 text-center">
                                      <span className="bg-neutral-100 px-3 py-1 rounded-lg font-mono font-black text-neutral-900">
                                        {Number(item.quantity) || 0}
                                      </span>
                                    </td>
                                    <td className="p-5 text-right font-mono text-neutral-500">€{(Number(item?.price) || 0).toFixed(2)}</td>
                                    <td className="p-5 text-right font-mono font-bold text-neutral-900">€{(Number(item?.total) || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-neutral-900 text-white">
                                  <td colSpan={3} className="p-5 font-bold uppercase tracking-widest text-xs text-right">{t('orders.total')}</td>
                                  <td className="p-5 text-right font-mono font-black text-lg">€{(Number(summary?.totalSales) || 0).toFixed(2)}</td>
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
