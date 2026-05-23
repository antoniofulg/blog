import { useMemo } from "react";
import {
	Bar,
	BarChart,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import type { DeviceClass } from "#/lib/analytics/device-detector";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
	deviceSplit: { mobile: number; tablet: number; desktop: number };
	locale: Locale;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_CLASSES: DeviceClass[] = ["mobile", "tablet", "desktop"];

/** Stable mapping from each DeviceClass to a chart color token. Exported for testing. */
export const DEVICE_COLORS: Record<DeviceClass, string> = {
	mobile: "var(--color-chart-1)",
	tablet: "var(--color-chart-2)",
	desktop: "var(--color-chart-3)",
};

const NEUTRAL_COLOR = "var(--color-muted)";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes integer percent share for a value within a total.
 * Returns 0 when total is 0 (avoids NaN on zero-sum data).
 * Exported for direct unit testing.
 */
export function computePercent(value: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((value / total) * 100);
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * DeviceSplitDonut — pure-presentational.
 *
 * Renders a Recharts donut (PieChart) at ≥ 480 px viewports and a horizontal
 * stacked BarChart below 480 px. Both variants always render; CSS hides the
 * inactive one via `hidden min-[480px]:block` / `block min-[480px]:hidden`.
 *
 * Zero-sum: renders a single neutral segment in the donut and empty-state copy.
 */
export function DeviceSplitDonut({ deviceSplit, locale }: Props) {
	const t = strings[locale].admin.analytics;

	const total = deviceSplit.mobile + deviceSplit.tablet + deviceSplit.desktop;
	const isEmpty = total === 0;

	// Pie data: neutral placeholder on zero-sum; 3 real slices otherwise.
	const pieData = useMemo(() => {
		if (isEmpty) {
			return [{ name: "empty", value: 1 }];
		}
		return DEVICE_CLASSES.map((device) => ({
			name: device,
			value: deviceSplit[device],
		}));
	}, [deviceSplit, isEmpty]);

	// Bar data: single row with all device counts (layout="vertical" → horizontal bar).
	const barData = useMemo(() => [{ ...deviceSplit }], [deviceSplit]);

	return (
		<div
			data-testid="device-split-donut"
			className="rounded-lg border border-border bg-card p-4"
		>
			<h2 className="mb-4 text-sm font-medium text-muted-foreground">
				{t.widgets.deviceSplit}
			</h2>

			{/* Zero-sum empty-state copy — shown in both layout variants */}
			{isEmpty && (
				<p
					data-testid="device-split-empty"
					className="mb-2 text-center text-xs text-muted-foreground"
				>
					{t.empty.awaitingData}
				</p>
			)}

			{/* Donut variant — hidden below 480 px */}
			<div className="hidden min-[480px]:block">
				<ResponsiveContainer width="100%" height={220}>
					<PieChart>
						<Pie
							data={pieData}
							dataKey="value"
							innerRadius={50}
							outerRadius={80}
						>
							{pieData.map((entry) => (
								<Cell
									key={entry.name}
									fill={
										entry.name === "empty"
											? NEUTRAL_COLOR
											: DEVICE_COLORS[entry.name as DeviceClass]
									}
								/>
							))}
						</Pie>
						{!isEmpty && <Legend />}
						<Tooltip
							formatter={(value: number, name: string) => [
								`${value} (${computePercent(value, total)}%)`,
								name,
							]}
						/>
					</PieChart>
				</ResponsiveContainer>
			</div>

			{/* Horizontal stacked bar — visible below 480 px */}
			<div className="block min-[480px]:hidden">
				<ResponsiveContainer width="100%" height={60}>
					<BarChart
						data={barData}
						layout="vertical"
						margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
					>
						{DEVICE_CLASSES.map((device) => (
							<Bar
								key={device}
								dataKey={device}
								stackId="devices"
								fill={DEVICE_COLORS[device]}
							/>
						))}
						{!isEmpty && <Legend />}
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
