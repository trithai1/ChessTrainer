export default class ChessAnalysis {
    constructor() {}

    async requestAnalysis(fen, searchmoves='') {
        const response = await fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: {fen: fen, searchmoves: searchmoves},
        });
        return response.json();
    }
}