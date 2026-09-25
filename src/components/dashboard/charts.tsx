"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ChartPoint } from "@/actions/dashboard";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  ASSIGNED: "#0284c7",
  IN_STORAGE: "#71717a",
  UNDER_MAINTENANCE: "#f59e0b",
  FOR_REPAIR: "#f97316",
  DAMAGED: "#ef4444",
  LOST: "#dc2626",
  STOLEN: "#b91c1c",
  RETIRED: "#a1a1aa",
  DISPOSED: "#52525b",
  TRANSFERRED: "#8b5cf6",
};

const PALETTE = ["#0284c7", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

function pointColor(point: ChartPoint, index: number): string {
  const statusColor = point.key ? STATUS_COLORS[point.key] : undefined;
  return statusColor ?? PALETTE[index % PALETTE.length];
}

function axisTick(value: number): string {
  return value >= 1000 ? `${formatNumber(value)} ` : String(value);
}

function currencyTick(value: number): string {
  return formatCurrency(value);
}

export function DonutChart({ data, height = 260 }: { data: ChartPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={56}
            outerRadius={92}
            paddingAngle={2}
            strokeWidth={1}
          >
            {data.map((point, index) => (
              <Cell key={point.label} fill={pointColor(point, index)} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBarChart({
  data,
  orientation = "vertical",
  height = 260,
  currency,
}: {
  data: ChartPoint[];
  orientation?: "vertical" | "horizontal";
  height?: number;
  currency?: boolean;
}) {
  const tickFormatter = currency ? currencyTick : axisTick;

  if (orientation === "horizontal") {
    return (
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-20" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tickFormatter} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={132}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((point, index) => (
                <Cell key={point.label} fill={pointColor(point, index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-20" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={tickFormatter} tickLine={false} axisLine={false} width={56} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((point, index) => (
              <Cell key={point.label} fill={pointColor(point, index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data, height = 240, currency }: { data: ChartPoint[]; height?: number; currency?: boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-20" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={currency ? currencyTick : axisTick}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
