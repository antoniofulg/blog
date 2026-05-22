import { useRef } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import type { Locale } from "#/lib/locale";

export const LOCALE_NAMES: Record<Locale, string> = {
	en: "English",
	"pt-br": "Português (BR)",
};

const COPY: Record<
	Locale,
	{
		title: string;
		body: (target: string) => string;
		confirm: string;
		cancel: string;
	}
> = {
	en: {
		title: "Content not available",
		body: (target) =>
			`This content is not available in ${target}. You will be redirected to the home page in ${target}.`,
		confirm: "Continue",
		cancel: "Cancel",
	},
	"pt-br": {
		title: "Conteúdo não disponível",
		body: (target) =>
			`Este conteúdo não está disponível em ${target}. Você será redirecionado para a página inicial em ${target}.`,
		confirm: "Continuar",
		cancel: "Cancelar",
	},
};

export type MissingTwinDialogProps = {
	open: boolean;
	currentLocale: Locale;
	targetLocale: Locale;
	onConfirm: () => void;
	onCancel: () => void;
};

export function MissingTwinDialog({
	open,
	currentLocale,
	targetLocale,
	onConfirm,
	onCancel,
}: MissingTwinDialogProps) {
	const copy = COPY[currentLocale];
	const targetName = LOCALE_NAMES[targetLocale];
	const cancelRef = useRef<HTMLButtonElement>(null);

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<DialogContent
				onOpenAutoFocus={(event) => {
					// The confirm action is destructive-ish: it navigates the reader
					// away from the page they're on. Cancel is the safer Enter target,
					// so redirect Radix's default initial focus (the close × icon) to
					// the cancel button.
					event.preventDefault();
					cancelRef.current?.focus();
				}}
			>
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.body(targetName)}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<button
						ref={cancelRef}
						type="button"
						onClick={onCancel}
						className="inline-flex items-center justify-center rounded-md border border-border-strong bg-background px-4 py-2 text-sm font-medium text-foreground transition-[color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
					>
						{copy.cancel}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-foreground-inverse transition-[color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
					>
						{copy.confirm}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
