import React, { useEffect, useState, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { Loader2, TrendingUp, Clock, Award, Users } from 'lucide-react';
import * as api from '../../../api';
import { useStore } from '../../../store/useStore';
import { useTranslation } from '../../../hooks/useTranslation';

const COLORS = ['#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

export const AnalyticsTab: React.FC = () => {
  const { t } = useTranslation();
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

  if (!data && loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {t('navigation.analytics')}
          </h1>
          <p className="text-neutral-500 text-sm md:text-base">
            {t('analytics.analytics_desc')}
          </p>
        </div>
      </div>

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
            <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.revenue_timeline')}</h3>
              <div className="h-80">
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
            <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.top_spenders')}</h3>
              <div className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                      <th className="pb-4">{t('orders.cardholder')}</th>
                      <th className="pb-4 text-center">{t('navigation.order_summary')}</th>
                      <th className="pb-4 text-right">{t('analytics.total_spent')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {data.topCustomers.map((c: any) => (
                      <tr key={c.rfid} className="group hover:bg-neutral-50 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-neutral-900">{c.name}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{c.rfid}</p>
                        </td>
                        <td className="py-4 text-center font-mono text-neutral-500">{c.count}</td>
                        <td className="py-4 text-right font-bold text-neutral-900">€{c.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Popular Items */}
            <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.popular_meals')}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.popularMeals} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#000000" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Popular Sides */}
            <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.popular_sides')}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.popularSides} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Activity Wave */}
            <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
              <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.activity_wave')}</h3>
              <div className="h-80">
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
