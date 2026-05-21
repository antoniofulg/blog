export type AuditType = "content" | "app";

export function formatFingerprint(
	type: AuditType,
	counts: { blocker: number; major: number },
): string {
	return `<!-- audit-fingerprint:${type}:blocker=${counts.blocker} major=${counts.major} -->`;
}

export const FINGERPRINT_GREP_LITERAL = "<!-- audit-fingerprint:";
