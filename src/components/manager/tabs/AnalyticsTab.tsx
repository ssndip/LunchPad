import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { Loader2, TrendingUp, Users, Clock, Award } from 'lucide-react';
import * as api from '../../../api';
import { useStore } from '../../../store/useStore';

import { useTranslation } from '../../../hooks/useTranslation';

const COLORS = ['#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

export const AnalyticsTab: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useStore(s => s.token);

  useEffect(() => {
    if (token) {
      api.fetchAnalytics(token)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data) return <div className="p-12 text-center text-neutral-400 font-bold">{t('analytics.failed_load')}</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<TrendingUp className="w-5 h-5 text-neutral-900" />}
          label={t('analytics.top_meal')}
          value={data.popularMeals[0]?.name || 'N/A'}
          subValue={`${data.popularMeals[0]?.count || 0} ${t('analytics.orders_unit')}`}
        />
        <StatCard 
          icon={<Award className="w-5 h-5 text-neutral-900" />}
          label={t('analytics.top_side')}
          value={data.popularSides[0]?.name || 'N/A'}
          subValue={`${data.popularSides[0]?.count || 0} ${t('analytics.times_unit')}`}
        />
        <StatCard 
          icon={<Clock className="w-5 h-5 text-neutral-900" />}
          label={t('analytics.peak_hour')}
          value={data.peakTimes.sort((a:any, b:any) => b.count - a.count)[0]?.hour || 'N/A'}
          subValue={t('analytics.highest_activity')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Popular Meals Chart */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.popular_meals')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.popularMeals} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Bar dataKey="count" fill="#000000" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Times Chart */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900 mb-8 uppercase tracking-tight">{t('analytics.activity_wave')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.peakTimes}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="count" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, subValue }: any) => (
  <div className="bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-neutral-50 rounded-xl">{icon}</div>
      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-2xl font-black text-neutral-900 truncate">{value}</div>
    <div className="text-xs font-bold text-neutral-400 mt-1">{subValue}</div>
  </div>
);
