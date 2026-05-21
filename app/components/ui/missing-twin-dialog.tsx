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

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.body(targetName)}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<button
						type="button"
						onClick={onCancel}
						className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{copy.cancel}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{copy.confirm}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
