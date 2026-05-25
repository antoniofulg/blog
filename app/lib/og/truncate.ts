/**
 * Truncates a code string to at most 10 lines OR 600 characters (joined with "\n"),
 * whichever limit is reached first.
 *
 * Returns:
 *   - `lines`: the (possibly truncated) line array
 *   - `didTruncate`: true when content was cut (caller can render a fade gradient)
 */
export function truncateCode(code: string): {
	lines: string[];
	didTruncate: boolean;
} {
	const allLines = code.split("\n");
	const result: string[] = [];
	let charCount = 0;
	let didTruncate = false;

	for (const line of allLines) {
		// Hard line cap
		if (result.length >= 10) {
			didTruncate = true;
			break;
		}

		// The separator "\n" between this line and the previous ones costs 1 char
		const sep = result.length > 0 ? 1 : 0;
		const wouldBe = charCount + sep + line.length;

		if (wouldBe > 600) {
			if (result.length === 0) {
				// Very first line exceeds budget — include the first 600 chars
				result.push(line.slice(0, 600));
			}
			// Any subsequent lines: just stop (don't add partial lines mid-block)
			didTruncate = true;
			break;
		}

		result.push(line);
		charCount += sep + line.length;
	}

	// Edge case: empty code string produces one empty line from split — keep it, no truncation
	return { lines: result, didTruncate };
}
