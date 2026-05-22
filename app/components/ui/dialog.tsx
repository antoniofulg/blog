import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type React from "react";

const IS_BROWSER = typeof window !== "undefined";

type DialogProps = React.ComponentProps<typeof RadixDialog.Root>;
export const Dialog: React.FC<DialogProps> = RadixDialog.Root;

export const DialogTrigger = RadixDialog.Trigger;

export const DialogContent: React.FC<{
	children: React.ReactNode;
	className?: string;
	// Pass-through for Radix's onOpenAutoFocus event. Use with
	// `event.preventDefault()` + an explicit focus() call to redirect initial
	// focus away from Radix's default (the close × button) to a safer target.
	onOpenAutoFocus?: React.ComponentProps<
		typeof RadixDialog.Content
	>["onOpenAutoFocus"];
}> = ({ children, className, onOpenAutoFocus }) => {
	if (!IS_BROWSER) return null;

	return (
		<RadixDialog.Portal>
			{/*
			 * Overlay tint uses `foreground` (Ink) at 50% — the brand's warm-tinted
			 * dark neutral. Never `bg-black` per DESIGN.md "never #000 or #fff" color
			 * law. The Ink hue keeps the overlay coherent with the page's tonal stack
			 * in both themes.
			 */}
			<RadixDialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
			<RadixDialog.Content
				onOpenAutoFocus={onOpenAutoFocus}
				className={[
					// Tonal step up from background → card sets the modal apart from the
					// page beneath without leaning on a shadow (DESIGN.md flat-by-default
					// — `shadow-md` is reserved for PostCard hover only).
					"fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-card p-6",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
					"data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
					className,
				]
					.filter(Boolean)
					.join(" ")}
			>
				{children}
				{/*
				 * Close × — muted at rest, foreground on hover. Color transition
				 * instead of opacity dimming keeps the icon legible at every state.
				 * No data-[state=open] decoration: the icon is always rendered when
				 * the dialog is open, so a state-bound color would fill it permanently.
				 */}
				<RadixDialog.Close className="absolute right-4 top-4 rounded-sm text-foreground-muted transition-[color,box-shadow] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none motion-reduce:transition-none">
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</RadixDialog.Close>
			</RadixDialog.Content>
		</RadixDialog.Portal>
	);
};

export const DialogHeader: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => (
	<div
		className={[
			"flex flex-col gap-y-1.5 text-center sm:text-left mb-2",
			className,
		]
			.filter(Boolean)
			.join(" ")}
	>
		{children}
	</div>
);

export const DialogTitle = RadixDialog.Title;

export const DialogDescription = RadixDialog.Description;

export const DialogFooter: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => (
	<div
		className={[
			"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
			className,
		]
			.filter(Boolean)
			.join(" ")}
	>
		{children}
	</div>
);

export const DialogClose = RadixDialog.Close;
