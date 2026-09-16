import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import type { YAxisTickContentProps } from 'recharts';
import { Loader2, TrendingUp, Clock, Award, Users } from 'lucide-react';
import * as api from '../../../api';
import { useStore } from '../../../store/useStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useResponsive } from '../../../hooks/useResponsive';
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
import { TabHeader } from '../../shared/TabHeader';

const COLORS = ['#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

// A recharts category YAxis renders its tick label as a raw SVG <text> with
// no built-in truncation: when a label is wider than the axis's allocated
// `width`, the overflow simply runs past the SVG's edge and is clipped
// invisibly rather than shown with an ellipsis. Menu item names are long
// Bulgarian dish names (20-30+ characters) that already overflow the
// desktop axis width of 100px, and the phone axis narrows to 72px, so
// without this the phone label would silently lose its start, not just its
// tail. Measuring with a canvas context and truncating with an ellipsis
// keeps every label legible instead of letting it vanish off-canvas.
let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === 'undefined') {
    measureCtx = null;
    return measureCtx;
  }
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

function truncateLabelToWidth(text: string, maxWidth: number, font: string): string {
  const ctx = getMeasureContext();
  if (!ctx) return text;
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : '…';
}

const CATEGORY_TICK_FONT = 'bold 10px Inter, system-ui, sans-serif';

/** Builds a YAxis `tick` renderer that truncates the category label to fit
 * within `maxWidth` px instead of letting recharts clip it off-canvas. */
const makeCategoryTick = (maxWidth: number) =>
  function CategoryTick({ x, y, payload }: YAxisTickContentProps) {
    const label = truncateLabelToWidth(String(payload?.value ?? ''), maxWidth, CATEGORY_TICK_FONT);
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fontWeight="bold" fill="#111827">
        {label}
      </text>
    );
  };

export const AnalyticsTab: React.FC = () => {
  const { t } = useTranslation();
  const { isPhone } = useResponsive();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useStore(s => s.token);
  
  // Analytics is now global/default view as requested

  const loadData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api.fetchAnalytics(token, {}) // Always global
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { topMeal, topSide, peakHour, sortedPeakTimes } = React.useMemo(() => {
    if (!data) return { topMeal: 'N/A', topSide: 'N/A', peakHour: 'N/A', sortedPeakTimes: [] };

    const topMealObj = [...data.popularMeals].sort((a, b) => b.count - a.count)[0];
    const topSideObj = [...data.popularSides].sort((a, b) => b.count - a.count)[0];
    const peakHourObj = [...data.peakTimes].sort((a, b) => b.count - a.count)[0];
    const sortedPeakTimesObj = [...data.peakTimes].sort((a, b) => {
      const hA = parseInt(a.hour) || 0;
      const hB = parseInt(b.hour) || 0;
      return hA - hB;
    });

    return {
      topMeal: topMealObj?.name || 'N/A',
      topSide: topSideObj?.name || 'N/A',
      peakHour: peakHourObj?.hour || 'N/A',
      sortedPeakTimes: sortedPeakTimesObj
    };
  }, [data]);

  const topSpenderColumns: DataListColumn[] = [
    { key: 'name', label: t('orders.cardholder') || '', role: 'title' },
    { key: 'count', label: t('analytics.orders_unit') || '', align: 'center' },
    { key: 'total', label: t('analytics.total_spent') || '', align: 'right' },
  ];

  const topSpenderRows: DataListRow[] = React.useMemo(() => {
    if (!data) return [];
    return data.topCustomers.map((c: any) => ({
      key: c.rfid,
      cells: {
        name: (
          <>
            <p className="font-bold text-neutral-900 break-all">{c.name}</p>
            <p className="text-[10px] text-neutral-400 font-mono break-all">{c.rfid}</p>
          </>
        ),
        count: <span className="font-mono text-neutral-500">{c.count}</span>,
        total: <span className="font-bold text-neutral-900">€{c.total.toFixed(2)}</span>,
      },
    }));
  }, [data]);

  if (!data && loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <TabHeader
        title={t('navigation.analytics')}
        subtitle={t('analytics.analytics_desc')}
      />

      {/* Analytics is now global/default view as requested */}


      {!data ? (
        <div className="p-12 text-center text-neutral-400 font-bold">{t('analytics.failed_load')}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard 
              label={t('analytics.total_revenue')}
              value={`€${data.summary.totalRevenue.toFixed(2)}`}
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              subValue={`${data.summary.totalOrders} ${t('analytics.total_orders_label')}`}
            />
            <StatCard 
              label={t('analytics.avg_order_value')}
              value={`€${data.summary.avgOrderValue.toFixed(2)}`}
              icon={<Award className="w-4 h-4 text-violet-600" />}
              subValue={t('analytics.per_transaction')}
            />
            <StatCard 
              label={t('analytics.unique_users')}
              value={data.summary.uniqueCustomers}
              icon={<Users className="w-4 h-4 text-blue-600" />}
              subValue={t('analytics.active_in_period')}
            />
            <StatCard 
              label={t('analytics.peak_activity')}
              value={peakHour}
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              subValue={t('analytics.busiest_hour')}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Revenue Timeline */}
            <div className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8 uppercase tracking-tight">{t('analytics.revenue_timeline')}</h3>
              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Spenders */}
            <div className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8 uppercase tracking-tight">{t('analytics.top_spenders')}</h3>
              <DataList
                columns={topSpenderColumns}
                rows={topSpenderRows}
                emptyMessage={t('analytics.no_spenders_found') || ''}
              />
            </div>

            {/* Popular Items */}
            <div className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8 uppercase tracking-tight">{t('analytics.popular_meals')}</h3>
              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.popularMeals}
                    layout="vertical"
                    margin={isPhone ? { top: 0, right: 8, left: 0, bottom: 0 } : { top: 0, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={makeCategoryTick(isPhone ? 64 : 92)}
                      width={isPhone ? 72 : 100}
                    />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#000000" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Popular Sides */}
            <div className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8 uppercase tracking-tight">{t('analytics.popular_sides')}</h3>
              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.popularSides}
                    layout="vertical"
                    margin={isPhone ? { top: 0, right: 8, left: 0, bottom: 0 } : { top: 0, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={makeCategoryTick(isPhone ? 64 : 92)}
                      width={isPhone ? 72 : 100}
                    />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Activity Wave */}
            <div className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8 uppercase tracking-tight">{t('analytics.activity_wave')}</h3>
              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sortedPeakTimes}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, subValue }: any) => (
  <div className="bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-neutral-50 rounded-xl">{icon}</div>
      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-2xl font-black text-neutral-900 truncate">{value}</div>
    <div className="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-tight">{subValue}</div>
  </div>
);
