import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

const variants = {
	tip: {
		bg: "bg-callout-tip",
		icon: CheckCircle,
		iconColor: "text-success",
		label: "Dica",
	},
	info: {
		bg: "bg-callout-info",
		icon: Info,
		iconColor: "text-accent",
		label: "Info",
	},
	warn: {
		bg: "bg-callout-warn",
		icon: AlertTriangle,
		iconColor: "text-warning",
		label: "Atenção",
	},
	error: {
		bg: "bg-callout-error",
		icon: XCircle,
		iconColor: "text-error",
		label: "Erro",
	},
} as const;

export function Callout({
	variant = "info",
	title,
	children,
}: {
	variant?: keyof typeof variants;
	title?: string;
	children: React.ReactNode;
}) {
	const v = variants[variant];
	const Icon = v.icon;

	return (
		<div className={`flex gap-3 rounded-lg ${v.bg} p-4`}>
			<Icon className={`h-5 w-5 shrink-0 ${v.iconColor}`} />
			<div className="flex flex-col gap-1">
				{title && (
					<span className="text-sm font-semibold text-foreground">{title}</span>
				)}
				<div className="text-sm leading-relaxed text-foreground-secondary">
					{children}
				</div>
			</div>
		</div>
	);
}
