export default class ChessAnalysis {
    constructor() {}

    async requestAnalysis(fen) {
        const response = await fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: fen,
        });
        return response.json();
    }
}