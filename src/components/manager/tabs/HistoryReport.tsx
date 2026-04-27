import React from 'react';
import { Order } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import { Printer, X, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface HistoryReportProps {
  orders: Order[];
  filters: {
    startDate: string;
    endDate: string;
    rfid: string;
  };
  onClose: () => void;
}

export const HistoryReport: React.FC<HistoryReportProps> = ({ orders, filters, onClose }) => {
  const { t } = useTranslation();
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
  const avgOrder = orders.length > 0 ? totalSpent / orders.length : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-neutral-900/60 backdrop-blur-md flex justify-center items-start overflow-y-auto p-4 md:p-20 print:p-0 print:bg-white print:static print:inset-auto print:z-auto print:block">
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] w-full max-w-6xl flex flex-col shadow-[0_32px_128px_rgba(0,0,0,0.3)] overflow-hidden print:shadow-none print:rounded-none print:h-auto print:max-w-none print:overflow-visible my-auto"
      >
        {/* Header - Hidden in Print */}
        <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0 sticky top-0 z-[60] print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-neutral-200">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-neutral-900 tracking-tight">{t('analytics.summary_report')}</h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{orders.length} {t('analytics.result_count')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              {t('cards.print')}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all"
              aria-label={t('modals.close')}
              title={t('modals.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content - The Actual A4 Report */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-neutral-100/50 print:p-0 print:bg-white print:overflow-visible custom-scrollbar">
          <div className="print-content bg-white shadow-[0_0_80px_rgba(0,0,0,0.05)] mx-auto w-full max-w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] print:shadow-none print:p-[10mm] print:max-w-none relative">
            
            {/* Corner Accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-neutral-900/5 rounded-bl-full print:hidden" />

            {/* Report Header */}
            <div className="flex justify-between items-start mb-12 border-b-4 border-neutral-900 pb-10 relative z-10">
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-2 text-neutral-900">LunchPad</h1>
                <div className="flex items-center gap-2">
                   <div className="h-1 w-8 bg-neutral-900" />
                   <p className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-[0.2em]">{t('navigation.dashboard')}</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black text-neutral-900 mb-2 uppercase tracking-tight">{t('analytics.summary_report')}</h2>
                <div className="inline-block px-3 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest">
                  {filters.startDate || '...'} — {filters.endDate || '...'}
                </div>
              </div>
            </div>

            {/* Filter Info */}
            <div className="grid grid-cols-2 gap-12 mb-12 bg-neutral-50 p-8 rounded-[32px] border border-neutral-100 print:bg-white print:border-neutral-200">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 font-black">{t('cards.owner_name')} / RFID</p>
                <p className="text-lg font-black text-neutral-900">{filters.rfid || t('filters.search_placeholder')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 font-black">{t('orders.timestamp')}</p>
                <p className="text-lg font-black text-neutral-900">{new Date().toLocaleString()}</p>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-6 mb-12">
              <div className="bg-white border-2 border-neutral-100 p-6 rounded-3xl shadow-sm">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 font-black">{t('analytics.result_count')}</p>
                <p className="text-3xl font-black text-neutral-900">{orders.length}</p>
              </div>
              <div className="bg-white border-2 border-neutral-100 p-6 rounded-3xl shadow-sm">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 font-black">{t('analytics.total_spending')}</p>
                <p className="text-3xl font-black text-neutral-900">€{totalSpent.toFixed(2)}</p>
              </div>
              <div className="bg-white border-2 border-neutral-100 p-6 rounded-3xl shadow-sm">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 font-black">{t('analytics.avg_transaction')}</p>
                <p className="text-3xl font-black text-neutral-900">€{avgOrder.toFixed(2)}</p>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="rounded-[24px] overflow-hidden border border-neutral-200 mb-12">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-900 text-white print:bg-neutral-100 print:text-neutral-900">
                    <th className="p-5 text-left text-[10px] uppercase tracking-widest font-black">{t('orders.timestamp')}</th>
                    <th className="p-5 text-left text-[10px] uppercase tracking-widest font-black">{t('orders.cardholder')}</th>
                    <th className="p-5 text-left text-[10px] uppercase tracking-widest font-black">{t('orders.items')}</th>
                    <th className="p-5 text-right text-[10px] uppercase tracking-widest font-black">{t('orders.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 border-b border-neutral-100">
                  {orders.map((order, idx) => (
                    <tr key={order.id} className="page-break-inside-avoid hover:bg-neutral-50/50 transition-colors">
                      <td className="p-5 text-xs align-top">
                        <p className="font-black text-neutral-900">{new Date(order.timestamp).toLocaleDateString()}</p>
                        <p className="text-neutral-400 font-mono text-[10px]">{new Date(order.timestamp).toLocaleTimeString()}</p>
                      </td>
                      <td className="p-5 text-xs align-top">
                        <p className="font-black text-neutral-900">{order.ownerName || t('menu.unknown_user')}</p>
                        <p className="text-neutral-400 font-mono text-[10px]">{order.rfid || 'N/A'}</p>
                      </td>
                      <td className="p-5 text-xs align-top">
                        <div className="space-y-1.5">
                          {Array.isArray(order.items) && order.items.map((item: any, i) => (
                            <div key={i} className="flex justify-between gap-4">
                              <span className="font-bold text-neutral-700">
                                {item.name} {item.side && <span className="text-neutral-400 italic font-medium">({item.side})</span>}
                              </span>
                              <span className="font-mono text-neutral-400 font-bold">x{item.quantity || 1}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-5 text-xs text-right font-black align-top text-neutral-900">
                        €{(Number(order.totalPrice) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Report Footer */}
            <div className="mt-auto pt-10 border-t border-neutral-100 flex justify-between items-center text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-black">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neutral-900" />
                <span>{t('analytics.summary_report')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>{new Date().toLocaleDateString()}</span>
                <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-900">LUNCHPAD PRO</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden !important; }
          .print-content, .print-content * { visibility: visible !important; }
          .print-content { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}} />
    </div>
  );
};
