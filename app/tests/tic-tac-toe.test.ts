// @vitest-environment jsdom
/**
 * Tests for app/components/posts/tic-tac-toe.tsx — the interactive demo embedded
 * at the end of the Spec-Driven Development post.
 *
 * Exercises the exact logic the post arrives at after its review round:
 *   - both diagonals present (regression for the anti-diagonal [2,4,6] bug)
 *   - the win checked before the draw
 *   - turn alternation, post-win lockout, reset, and locale copy
 *
 * File is .ts (not .tsx) per project convention — React.createElement throughout.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateWinner, TicTacToe } from "#/components/posts/tic-tac-toe";

afterEach(cleanup);

// First 9 buttons in DOM order are the squares; the reset button follows.
function squares() {
	return screen.getAllByRole("button").slice(0, 9);
}
function statusText() {
	return screen.getByRole("status").textContent;
}

describe("calculateWinner", () => {
	it("detects the anti-diagonal [2,4,6] — the bug the post's review caught", () => {
		const board: ("X" | "O" | null)[] = [
			null,
			null,
			"X",
			null,
			"X",
			null,
			"X",
			null,
			null,
		];
		expect(calculateWinner(board)).toBe("X");
	});

	it("returns null on an empty board", () => {
		expect(calculateWinner(Array<"X" | "O" | null>(9).fill(null))).toBeNull();
	});
});

describe("TicTacToe", () => {
	it("renders a 3x3 grid and the starting turn status", () => {
		render(React.createElement(TicTacToe, { locale: "en" }));
		expect(squares()).toHaveLength(9);
		expect(statusText()).toBe("Turn: X");
	});

	it("alternates turns, detects a win, then ignores further clicks", () => {
		render(React.createElement(TicTacToe, { locale: "en" }));
		const s = squares();
		fireEvent.click(s[0]); // X
		fireEvent.click(s[3]); // O
		fireEvent.click(s[1]); // X
		fireEvent.click(s[4]); // O
		fireEvent.click(s[2]); // X completes the top row
		expect(statusText()).toBe("Winner: X");

		fireEvent.click(s[5]); // game over → click is a no-op
		expect(statusText()).toBe("Winner: X");
	});

	it("detects a draw when the board fills with no winner", () => {
		render(React.createElement(TicTacToe, { locale: "en" }));
		const s = squares();
		// Fills to X O X / X O O / O X X — full, no line, no premature win.
		for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
			fireEvent.click(s[i]);
		}
		expect(statusText()).toBe("Draw, nobody wins");
	});

	it("reset clears the board back to X's turn", () => {
		render(React.createElement(TicTacToe, { locale: "en" }));
		const s = squares();
		fireEvent.click(s[0]);
		expect(statusText()).toBe("Turn: O");
		fireEvent.click(screen.getByRole("button", { name: "Restart" }));
		expect(statusText()).toBe("Turn: X");
	});

	it("renders pt-br copy", () => {
		render(React.createElement(TicTacToe, { locale: "pt-br" }));
		expect(statusText()).toBe("Vez de: X");
	});
});
