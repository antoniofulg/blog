const WORDS_PER_MINUTE = 220;

export function readingTimeMinutes(htmlOrText: string): number {
	const text = htmlOrText.replace(/<[^>]+>/g, " ");
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
