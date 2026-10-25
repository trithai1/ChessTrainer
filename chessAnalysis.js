export default class ChessAnalysis {
    constructor() {}

    async requestAnalysis({fen, input}) {
        input = Array.isArray(input) ? input.join(" ") : input;
        const response = await fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({fen, input}),
        });
        return response.json();
    }
}