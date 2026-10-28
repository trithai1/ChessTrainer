export default class ChessAnalysis {
    constructor() {}

    async requestAnalysis({fen, input}) {
        if (Array.isArray(input)) {
            input = input.map((move, idx) => `${idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${move}` : move}`)
            .join(" ");
        }
        const response = await fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({fen, input}),
        });
        return await response.json();
    }
}