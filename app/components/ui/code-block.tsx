import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({
	code,
	language = "typescript",
	filename,
}: {
	code: string;
	language?: string;
	filename?: string;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="overflow-hidden rounded-lg border border-border bg-code-bg">
			{filename && (
				<div className="flex items-center justify-between border-b border-border px-4 py-2">
					<span className="text-xs font-medium text-foreground-muted">
						{filename}
					</span>
					<span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground-muted">
						{language}
					</span>
				</div>
			)}
			<div className="relative">
				<pre className="overflow-x-auto p-4 font-code text-sm leading-relaxed text-foreground-code">
					<code>{code}</code>
				</pre>
				<button
					type="button"
					onClick={handleCopy}
					className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground-muted transition-colors hover:text-foreground-code"
					aria-label="Copiar código"
				>
					{copied ? (
						<Check className="h-4 w-4 text-success" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
		</div>
	);
}
