import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

export default {
	content: ["./app/**/*.{ts,tsx}", "./index.html"],
	plugins: [typography],
} satisfies Config;
