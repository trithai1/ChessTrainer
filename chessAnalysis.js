export default class ChessAnalysis {
    constructor() {}

    async requestAnalysis(fen) {
        const response = await fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // body: JSON.stringify({fen}),
            body: JSON.stringify({input: "1. e4 a6 2. e5 d5"}),
        });
        return response.json();
    }
}