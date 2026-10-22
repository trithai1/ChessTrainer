import Chess from "../../Logicore/chess.js";
import ChessPuzzle from "./chessPuzzle.js";
import ChessPosition from "./chessPosition.js";
import ChessAnalysis from "./chessAnalysis.js";

export default class ChessChallenge {
    // Type
    static PUZZLE = "puzzle";
    static POSITION = "position";

    constructor() {
        this.chess;
        this.pool = [];
        this.chessPuzzle = new ChessPuzzle();
        this.chessPosition = new ChessPosition();
        this.chessAnalysis = new ChessAnalysis();
        this.puzzleRating = 1000;
        this.positionRating = 1000;
        this.challenge;
        this.isSolved = null;
    }

    async load() {
        await this.chessPuzzle.load();
        await this.chessPosition.load();
    }

    static randomPoolNumber(pool, n) {
        if (pool.length === 0) {
            pool = Array.from({length: n}, (_, i) => i);
        }

        const randIdx = Math.floor(Math.random() * pool.length);
        const value = pool.splice(randIdx, 1)[0];
        return [pool, value];
    }

    getRandomNumber5(minElo = 0, maxElo = 3000) {
        const t = Math.max(0, Math.min(1, (this.positionRating - minElo) / (maxElo - minElo)));

        // Weights for numbers 1-5
        const lowElo  = [86, 8, 3, 2, 1];
        const highElo = [28, 40, 28, 2.5, 1.5];

        const weights = lowElo.map((w, i) =>
            w + (highElo[i] - w) * t
        );

        let roll = Math.random() * 100;

        for (let i = 0; i < weights.length; i++) {
            roll -= weights[i];
            if (roll < 0) return i + 1;
        }

        return 1;
    }

    async nextChallenge() {
        const [newPool, value] = ChessChallenge.randomPoolNumber(this.pool, 6);
        this.pool = newPool;

        const isPuzzle = false; // value % 2 === 0;
        if (isPuzzle) {
            this.challenge = {
                type: ChessChallenge.PUZZLE,
                puzzle: this.chessPuzzle.getRandomPuzzle(this.puzzleRating),
                moveIndex: 1,
            };
            this.chess = new Chess(this.challenge.puzzle.fen);
            this.chess.makeMove(this.challenge.puzzle.moves[0]);
        } else {
            this.challenge = {
                type: ChessChallenge.POSITION,
                position: this.chessPosition.getRandomPosition(this.positionRating),
                maxMoves: this.getRandomNumber5(),
                moveCount: 0,
                currentScore: undefined,
                bestMove: undefined,
                mate: undefined,
            };

            this.chess = new Chess();
            this.challenge.position.moves.forEach(entry => this.chess.makeMove(entry.move));

            const analysis = await this.chessAnalysis.requestAnalysis(this.chess.getFen());
            this.challenge.currentScore = analysis.eval;
            this.challenge.bestMove = analysis.move;
            this.challenge.mate = analysis.mate ? Number(analysis.mate) : null;
        }
        this.isSolved = null;
    }

    getEvalRange(score, mate) {
        if (mate < 0) return 0; // Black Mating
        else if (mate > 0) return 8; // White Mating
        else if (score > 2) return 7; // White Hard Winning
        else if (score > 1) return 6; // White Winning
        else if (score > 0.5) return 5; // White Advantage
        else if (score > -0.5) return 4; // Drawish
        else if (score > -1) return 3; // Black Advantage
        else if (score > -2) return 2; // Black Hard Winning
        else return 1; // Black Winning
    }

    normalizeEval(evalScore, mate = null) {
        if (mate !== null) {
            if (mate === 0) return 0;

            // Diminishing returns, 7 approaching 8
            return Math.sign(mate) * (7 + 1 / Math.abs(mate));
        }

        const sign = Math.sign(evalScore);
        const abs = Math.abs(evalScore);

        let score;
        if (abs < 0.5) { // Drawish: 0 -> 0.5
            score = abs * 4; // 0 -> 2
        } else if (abs < 1) { // Advantage: 0.5 -> 1
            score = 2 + (abs - 0.5) * 4; // 2 -> 4
        } else if (abs < 2) { // Winning: 1 -> 2
            score = 4 + (abs - 1) * 2; // 4 -> 6
        } else { // Hard Winning: 2+
            score = 6 + (1 - Math.exp(-(abs - 2) / 3)); // Diminishing returns, 6 approaching 7
        }
        return sign * score;
    }

    compareEvals(prevScore, prevMate, curScore, curMate) {
        return {
            categoryDiff: this.getEvalRange(curScore, curMate) - this.getEvalRange(prevScore, prevMate),
            normalizeDiff: this.normalizeEval(curScore, curMate) - this.normalizeEval(prevScore, prevMate),
            classification: getMoveClassification(expectedPointLoss(prevScore, curScore)),
        };
    }

    expectedPointLoss(evalBefore, evalAfter) {
        // Convert pawn evaluation into expected score (0-1)
        const expectedScore = (centiPawn) => 1 / (1 + Math.exp(-1.2 * centiPawn));

        const before = expectedScore(evalBefore);
        const after = expectedScore(evalAfter);

        return Math.max(0, before - after);
    }

    getMoveClassification(pointLoss) {
        if (pointLoss <= 0) return "best";
        if (pointLoss <= 0.02) return "excellent";
        if (pointLoss <= 0.05) return "good";
        if (pointLoss <= 0.10) return "inaccuracy";
        if (pointLoss <= 0.20) return "mistake";
        return "blunder";
    }

    getRatingChange(playerRating, challengeRating, solved, k=32) {
        const expected = 1 / (1 + 10 ** ((challengeRating - playerRating) / 400));
        return Math.round(k * ((solved ? 1 : 0) - expected));
    }

    async submitMove(move) {
        if (this.isSolved) return null;
        let evaluation = {
            isCorrect: false,
            isSolved: this.isSolved,
            curMoveResult: null,
            nextMoveResult: null,
        };
        
        if (this.challenge.type === ChessChallenge.PUZZLE) {
            const moveUCI = this.chess.parseToUCINotation(move);
            evaluation.isCorrect = this.chessPuzzle.evaluateMove(this.challenge.puzzle, this.challenge.moveIndex, moveUCI);
            if (evaluation.isCorrect) {
                evaluation.curMoveResult = this.chess.makeMove(move);
                this.challenge.moveIndex++;
                if (this.challenge.moveIndex < this.challenge.puzzle.moves.length) {
                    const nextMove = this.chess.parseChessMove(this.challenge.puzzle.moves[this.challenge.moveIndex]);
                    evaluation.nextMoveResult = this.chess.makeMove(nextMove);
                    this.challenge.moveIndex++;
                } else if (this.isSolved === null) evaluation.isSolved = this.isSolved = true;
            } else if (this.isSolved === null) evaluation.isSolved = this.isSolved = false;
        
        } else if (this.challenge.type === ChessChallenge.POSITION) {
            const analysis = await this.chessPosition.evaluateMove(this.chessAnalysis, this.challenge.chess.getFen(), move);
            const moveScore = analysis.eval;
            const moveMate = analysis.mate ? Number(analysis.mate) : null;
            const compare = this.compareEvals(this.challenge.currentScore, this.challenge.mate, moveScore, moveMate);

            // category change of 0-1 is +elo, category change of 2+ is -elo
            // get how much elo change
            // adjust the elo change based on normalized difference
            evaluation.isCorrect = compare.categoryDiff < 2;
            evaluation.moveEval = compare.classification;

            if (evaluation.isCorrect) {
                this.chess.makeMove()
                evaluation.nextMove = undefined; // this.chess.parseChessMove(move);
                this.challenge.moveCount++;
                if (this.challenge.moveCount < this.challenge.maxMoves) {
                    this.challenge.currentScore = undefined;
                    this.challenge.bestMove = undefined;
                    this.challenge.mate = undefined;
                } else if (this.isSolved === null) evaluation.isSolved = this.isSolved = true;
            } else if (this.isSolved === null) evaluation.isSolved = this.isSolved = false;
        }
        return evaluation;
    }
}
