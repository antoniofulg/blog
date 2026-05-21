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
}> = ({ children, className }) => {
	if (!IS_BROWSER) return null;

	return (
		<RadixDialog.Portal>
			<RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
			<RadixDialog.Content
				className={[
					"fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-6 shadow-lg",
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
				<RadixDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-foreground-secondary">
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
		className={["flex flex-col space-y-1.5 text-center sm:text-left", className]
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
