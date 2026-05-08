"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type SummaryRow = {
  key: string;
  label: string;
  description?: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
};

type Props = {
  provinceStats: SummaryRow[];
  wardStats: SummaryRow[];
  categoryStats: SummaryRow[];
  totalPlaces: number;
  approvedPlaces: number;
  pendingPlaces: number;
  rejectedPlaces: number;
};

const statusConfig: ChartConfig = {
  approved: { label: "Đã duyệt", color: "var(--chart-1)" },
  pending: { label: "Chờ duyệt", color: "var(--chart-2)" },
  rejected: { label: "Từ chối", color: "var(--chart-3)" },
};

const BAR_ROW_HEIGHT = 40;
const BAR_CHART_MARGIN = { top: 8, right: 24, bottom: 8, left: 0 };
const Y_AXIS_WIDTH = 160;
const TOP_N = 10;

function truncateLabel(text: string, maxLen = 24) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function buildBarData(rows: SummaryRow[]) {
  return rows.slice(0, TOP_N).map((row) => ({
    label: truncateLabel(row.label),
    fullLabel: row.label,
    approved: row.approved,
    pending: row.pending,
    rejected: row.rejected,
  }));
}

function HorizontalStackedBar({
  data,
  title,
  description,
  emptyLabel,
}: {
  data: ReturnType<typeof buildBarData>;
  title: string;
  description: string;
  emptyLabel: string;
}) {
  const chartHeight = Math.max(180, data.length * BAR_ROW_HEIGHT + 56);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusConfig} style={{ height: chartHeight }}>
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={data}
            margin={BAR_CHART_MARGIN}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickMargin={4} />
            <YAxis
              type="category"
              dataKey="label"
              width={Y_AXIS_WIDTH}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  labelKey="fullLabel"
                  nameKey="name"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="approved"
              name="Đã duyệt"
              stackId="status"
              fill="var(--color-approved)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="pending"
              name="Chờ duyệt"
              stackId="status"
              fill="var(--color-pending)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="rejected"
              name="Từ chối"
              stackId="status"
              fill="var(--color-rejected)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function StatusDonut({
  totalPlaces,
  approvedPlaces,
  pendingPlaces,
  rejectedPlaces,
}: Pick<Props, "totalPlaces" | "approvedPlaces" | "pendingPlaces" | "rejectedPlaces">) {
  const data = [
    { status: "approved", name: "Đã duyệt", value: approvedPlaces, fill: "var(--color-approved)" },
    { status: "pending", name: "Chờ duyệt", value: pendingPlaces, fill: "var(--color-pending)" },
    { status: "rejected", name: "Từ chối", value: rejectedPlaces, fill: "var(--color-rejected)" },
  ].filter((row) => row.value > 0);

  if (totalPlaces === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tỉ lệ trạng thái duyệt</CardTitle>
          <CardDescription>Phân bổ trạng thái của toàn bộ địa điểm đang hiển thị.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chưa có địa điểm nào.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center pb-2">
        <CardTitle>Tỉ lệ trạng thái duyệt</CardTitle>
        <CardDescription>Phân bổ trạng thái của toàn bộ địa điểm đang hiển thị.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusConfig} className="mx-auto aspect-square max-h-65">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="name" />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              strokeWidth={4}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalPlaces.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 24}
                          className="fill-muted-foreground text-xs"
                        >
                          Địa điểm
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function EventStatsCharts({
  provinceStats,
  wardStats,
  categoryStats,
  totalPlaces,
  approvedPlaces,
  pendingPlaces,
  rejectedPlaces,
}: Props) {
  const provinceBarData = buildBarData(provinceStats);
  const wardBarData = buildBarData(wardStats);
  const categoryBarData = buildBarData(categoryStats);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <StatusDonut
          totalPlaces={totalPlaces}
          approvedPlaces={approvedPlaces}
          pendingPlaces={pendingPlaces}
          rejectedPlaces={rejectedPlaces}
        />

        <HorizontalStackedBar
          data={categoryBarData}
          title="Phân bổ theo danh mục"
          description="Top 10 danh mục có nhiều địa điểm nhất, phân chia theo trạng thái duyệt."
          emptyLabel="Chưa có địa điểm nào trong phạm vi lọc hiện tại."
        />
      </div>

      <HorizontalStackedBar
        data={provinceBarData}
        title="Địa điểm theo tỉnh (top 10)"
        description="Số lượng địa điểm tại 10 tỉnh có nhiều địa điểm nhất, phân chia theo trạng thái duyệt."
        emptyLabel="Chưa có tỉnh nào trong phạm vi lọc hiện tại."
      />

      {wardBarData.length > 0 && (
        <HorizontalStackedBar
          data={wardBarData}
          title="Địa điểm theo xã (top 10)"
          description="Số lượng địa điểm tại 10 xã có nhiều địa điểm nhất, phân chia theo trạng thái duyệt."
          emptyLabel="Chưa có xã nào trong phạm vi lọc hiện tại."
        />
      )}
    </div>
  );
}
