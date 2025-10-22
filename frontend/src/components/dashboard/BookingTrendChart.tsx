'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from '@/lib/i18n';

export type BookingTrendPoint = {
  label: string;
  value: number;
};

interface BookingTrendChartProps {
  data: BookingTrendPoint[];
}

export default function BookingTrendChart({ data }: BookingTrendChartProps) {
  const t = useTranslations();
  const axisSuffix = t('dashboard.trend.axisSuffix');
  const tooltipLabel = t('dashboard.trend.tooltip');

  if (!data.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        {t('dashboard.trend.empty')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5B8DEF" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#5B8DEF" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" stroke="#A0AEC0" tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis
          stroke="#A0AEC0"
          tickLine={false}
          axisLine={{ stroke: '#E2E8F0' }}
          tickFormatter={(value) => `${value}${axisSuffix}`}
        />
        <Tooltip
          cursor={{ stroke: '#5B8DEF', strokeWidth: 1 }}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            fontSize: 12,
          }}
          labelStyle={{ color: '#4A5568', fontWeight: 600 }}
          formatter={(value: number) => [`${value}${axisSuffix}`, tooltipLabel]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#5B8DEF"
          strokeWidth={2}
          fill="url(#colorBookings)"
          dot={{ r: 3, fill: '#5B8DEF', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
