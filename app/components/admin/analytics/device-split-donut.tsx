import { Activity } from "lucide-react";
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
import { EmptyState } from "#/components/ui/empty-state";
import type { DeviceClass } from "#/lib/analytics/device-detector";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
	deviceSplit: { mobile: number; tablet: number; desktop: number };
	locale: Locale;
	/** When set, distinguishes "filter returned no rows" from "no events ever". */
	postId?: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_CLASSES: DeviceClass[] = ["mobile", "tablet", "desktop"];

/** Stable mapping from each DeviceClass to a chart color token. Exported for testing. */
export const DEVICE_COLORS: Record<DeviceClass, string> = {
	mobile: "var(--color-chart-1)",
	tablet: "var(--color-chart-2)",
	desktop: "var(--color-chart-3)",
};

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
 * Zero-sum: renders EmptyState instead of chart variants (task_18).
 */
export function DeviceSplitDonut({ deviceSplit, locale, postId }: Props) {
	const t = strings[locale].admin.analytics;

	const total = deviceSplit.mobile + deviceSplit.tablet + deviceSplit.desktop;
	const isEmpty = total === 0;

	// Pie data: 3 real slices (only used when non-empty).
	const pieData = useMemo(() => {
		return DEVICE_CLASSES.map((device) => ({
			name: device,
			value: deviceSplit[device],
		}));
	}, [deviceSplit]);

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

			{isEmpty ? (
				<EmptyState
					icon={Activity}
					title={
						postId !== undefined ? t.empty.noDataForPost : t.empty.awaitingData
					}
					description={
						postId !== undefined
							? t.empty.noDataForPostDescription
							: t.empty.awaitingDataDescription
					}
				/>
			) : (
				<>
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
											fill={DEVICE_COLORS[entry.name as DeviceClass]}
										/>
									))}
								</Pie>
								<Legend />
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
								<Legend />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</>
			)}
		</div>
	);
}
