import { useReducer } from "react";
import type { Locale } from "#/lib/locale";

// Interactive demo for the Spec-Driven Development post. This is the exact
// logic the post arrives at after the review round: both diagonals present in
// LINES, and the win checked before the draw.

type Cell = "X" | "O" | null;
type Board = Cell[];

const LINES: readonly (readonly [number, number, number])[] = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

export function calculateWinner(board: Board): Cell {
	for (const [a, b, c] of LINES) {
		if (board[a] && board[a] === board[b] && board[a] === board[c]) {
			return board[a];
		}
	}
	return null;
}

function currentPlayer(board: Board): "X" | "O" {
	return board.filter(Boolean).length % 2 === 0 ? "X" : "O";
}

type State = { board: Board };
type Action = { type: "play"; index: number } | { type: "reset" };

const initialState: State = { board: Array<Cell>(9).fill(null) };

// Stable per-position keys: the 9 squares never reorder, so a fixed positional
// id is the correct identity (and keeps the array-index-key lint happy).
const SQUARE_KEYS = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"] as const;

function reducer(state: State, action: Action): State {
	if (action.type === "reset") return initialState;
	const { board } = state;
	// Ignore clicks on a filled square or after the game is over.
	if (board[action.index] || calculateWinner(board)) return state;
	const next = board.slice();
	next[action.index] = currentPlayer(board);
	return { board: next };
}

const COPY = {
	en: {
		heading: "Try it: tic-tac-toe",
		caption:
			"The exact logic from this post: both diagonals, the win checked before the draw.",
		turn: (p: string) => `Turn: ${p}`,
		winner: (p: string) => `Winner: ${p}`,
		draw: "Draw, nobody wins",
		reset: "Restart",
		empty: (n: number) => `Square ${n}, empty`,
		filled: (n: number, mark: string) => `Square ${n}, ${mark}`,
	},
	"pt-br": {
		heading: "Experimente: jogo da velha",
		caption:
			"A lógica exata deste post: as duas diagonais, a vitória checada antes do empate.",
		turn: (p: string) => `Vez de: ${p}`,
		winner: (p: string) => `Vencedor: ${p}`,
		draw: "Empate, ninguém vence",
		reset: "Reiniciar",
		empty: (n: number) => `Casa ${n}, vazia`,
		filled: (n: number, mark: string) => `Casa ${n}, ${mark}`,
	},
} as const;

type Props = { locale: Locale };

export function TicTacToe({ locale }: Props) {
	const [state, dispatch] = useReducer(reducer, initialState);
	const { board } = state;
	const c = COPY[locale] ?? COPY.en;

	const winner = calculateWinner(board);
	const full = board.every(Boolean);
	const status = winner
		? c.winner(winner)
		: full
			? c.draw
			: c.turn(currentPlayer(board));
	const gameOver = winner !== null || full;

	return (
		<section
			aria-labelledby="ttt-heading"
			className="my-12 rounded-lg border border-border bg-card p-6"
		>
			<h2
				id="ttt-heading"
				className="font-heading text-xl font-bold text-foreground"
			>
				{c.heading}
			</h2>
			<p className="mt-1 text-sm text-foreground-secondary">{c.caption}</p>

			<output
				aria-live="polite"
				className="mt-5 block font-code text-sm font-semibold text-foreground"
			>
				{status}
			</output>

			<div className="mt-3 grid w-full max-w-60 grid-cols-3 gap-1.5">
				{board.map((cell, i) => {
					const label = cell ? c.filled(i + 1, cell) : c.empty(i + 1);
					return (
						<button
							key={SQUARE_KEYS[i]}
							type="button"
							aria-label={label}
							// aria-disabled (not `disabled`) keeps played/over cells in the tab
							// order so keyboard focus is not lost when a cell becomes inert on
							// play; the reducer already no-ops clicks on filled squares / after
							// the game ends.
							aria-disabled={cell !== null || gameOver}
							onClick={() => dispatch({ type: "play", index: i })}
							className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-border bg-background font-heading text-2xl font-bold text-foreground transition-colors hover:border-accent aria-disabled:cursor-not-allowed aria-disabled:hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						>
							<span aria-hidden="true">{cell}</span>
						</button>
					);
				})}
			</div>

			<button
				type="button"
				onClick={() => dispatch({ type: "reset" })}
				className="mt-5 inline-flex h-11 cursor-pointer items-center rounded-md bg-accent px-4 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				{c.reset}
			</button>
		</section>
	);
}
