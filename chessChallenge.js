import Chess from "./Logicore/chess.js";
import ChessPuzzle from "./chessPuzzle.js";
import ChessPosition from "./chessPosition.js";
import ChessAnalysis from "./chessAnalysis.js";
import { GAME_STATUS, PIECE_COLOR } from "./Logicore/chess_constants.js";

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
        this.solved = null;
        this.pass = null;
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

    async nextChallenge(challengeSession=null) {
        this.solved = null;
        this.pass = challengeSession ? challengeSession.pass : null;
        
        let isPuzzle;
        if (challengeSession) {
            isPuzzle = challengeSession.type === ChessChallenge.PUZZLE;
        } else {
            const [newPool, value] = ChessChallenge.randomPoolNumber(this.pool, 6);
            this.pool = newPool;
            isPuzzle = value % 2 === 0;
        }
        
        if (isPuzzle) {
            const {puzzle, index} = challengeSession ? 
                {puzzle: this.chessPuzzle.getPuzzle(challengeSession.index), index: challengeSession.index} :
                this.chessPuzzle.getRandomPuzzle(this.puzzleRating);
            
            challengeSession = {
                type: ChessChallenge.PUZZLE,
                index: index,
                pass: this.pass,
            };

            this.challenge = {
                type: ChessChallenge.PUZZLE,
                puzzle,
                rating: undefined,
                moveIndex: 1,
            };
            this.challenge.rating = this.challenge.puzzle.rating;
            this.chess = new Chess(this.challenge.puzzle.fen);
            this.chess.makeMove(this.challenge.puzzle.moves[0]);
        } else {
            const {position, index, moveIndex} = challengeSession ?
                {position: this.chessPosition.getPosition(challengeSession.index, challengeSession.moveIndex), index: challengeSession.index, moveIndex: challengeSession.moveIndex} :
                this.chessPosition.getRandomPosition(this.positionRating);
            
            challengeSession = {
                type: ChessChallenge.POSITION,
                index: index,
                moveIndex: moveIndex,
                pass: this.pass,
            };

            this.challenge = {
                type: ChessChallenge.POSITION,
                position,
                rating: undefined,
                maxMoves: this.getRandomNumber5(),
                moveCount: 0,
                currentScore: undefined,
                bestMove: undefined,
                mate: undefined,
                ratingChanges: [],
            };
            this.challenge.rating = Math.floor((this.challenge.position.blackElo + this.challenge.position.whiteElo) / 2);
            this.chess = new Chess();
            this.challenge.position.moves.forEach(entry => this.chess.makeMove(entry.move));

            const analysis = await this.chessAnalysis.requestAnalysis({input: this.chess.movesSAN});
            this.challenge.currentScore = analysis.eval;
            this.challenge.bestMove = analysis.move;
            this.challenge.mate = analysis.mate ? Number(analysis.mate) : null;
        }
        return challengeSession;
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

    expectedPointLoss(evalBefore, evalAfter) {
        // Convert evaluations to the player's perspective
        const sign = this.chess.activeColor === PIECE_COLOR.WHITE ? 1 : -1;

        evalBefore *= sign;
        evalAfter *= sign;

        // Convert pawn evaluation into expected score (0-1)
        const expectedScore = (centiPawn) => 1 / (1 + Math.exp(-1.2 * centiPawn));

        const before = expectedScore(evalBefore);
        const after = expectedScore(evalAfter);

        return Math.max(0, before - after);
    }

    getMoveClassification(pointLoss, categoryDiff) {
        if (pointLoss <= 0) return "best";
        if (pointLoss <= 0.04) return "excellent";
        if (pointLoss <= 0.13) return "good";
        if (pointLoss <= 0.18 || categoryDiff === 0) return "inaccuracy";
        if (pointLoss <= 0.28) return "mistake";
        return "blunder";
    }

    compareEvals(prevScore, prevMate, curScore, curMate) {
        const categoryDiff = this.getEvalRange(curScore, curMate) - this.getEvalRange(prevScore, prevMate)
        return {
            categoryDiff: categoryDiff,
            normalizeDiff: this.normalizeEval(curScore, curMate) - this.normalizeEval(prevScore, prevMate),
            classification: this.getMoveClassification(this.expectedPointLoss(prevScore, curScore), categoryDiff),
        };
    }

    getRatingChange(playerRating, challengeRating, pass, normalizeDiff=null, k=32) {
        const expected = 1 / (1 + 10 ** ((challengeRating - playerRating) / 400));
        let ratingChange = Math.round(k * ((pass ? 1 : 0) - expected));

        if (normalizeDiff) {
            const diff = Math.max(0, normalizeDiff);
            ratingChange *= Math.exp(-diff / 1.5);
            ratingChange = Math.round(ratingChange);
        }
        return ratingChange
    }

    async submitMove(move) {
        if (this.solved) return null;
        let result = {
            correct: false,
            solved: null,
            pass: this.pass,
            curMoveResult: null,
            nextMoveResult: null,
            ratingChange: null,
        };
        
        // Puzzle Challenge
        if (this.challenge.type === ChessChallenge.PUZZLE) {
            const moveUCI = this.chess.parseToUCINotation(move);
            result.correct = this.chessPuzzle.evaluateMove(this.challenge.puzzle, this.challenge.moveIndex, moveUCI);
            if (result.correct) {
                result.curMoveResult = this.chess.makeMove(move);
                this.challenge.moveIndex++;
                if (this.challenge.moveIndex < this.challenge.puzzle.moves.length) {
                    const nextMove = this.chess.parseChessMove(this.challenge.puzzle.moves[this.challenge.moveIndex]);
                    result.nextMoveResult = this.chess.makeMove(nextMove);
                    this.challenge.moveIndex++;
                } else {
                    result.solved = this.solved = true;
                    if (this.pass === null) {
                        result.pass = this.pass = true;
                        result.ratingChange = this.getRatingChange(this.puzzleRating, this.challenge.rating, this.pass);
                        this.puzzleRating = Math.min(3400, this.puzzleRating + result.ratingChange);
                    }
                }
            } else {
                result.solved = this.solved = false;
                if (this.pass === null) {
                    result.pass = this.pass = false;
                    result.ratingChange = this.getRatingChange(this.puzzleRating, this.challenge.rating, this.pass);
                    this.puzzleRating = Math.max(0, this.puzzleRating + result.ratingChange);
                }
            }
        
        // Position Challenge
        } else if (this.challenge.type === ChessChallenge.POSITION) {
            const isBest = this.chess.sameMove(move, this.challenge.bestMove);
            const analysis = isBest ?
                { eval: this.challenge.currentScore, mate: this.challenge.mate, move: this.challenge.bestMove } :
                await this.chessPosition.evaluateMove(this.chessAnalysis, this.chess, move);
            const moveScore = analysis.eval;
            const moveMate = analysis.mate ? Number(analysis.mate) : null;
            const compare = this.compareEvals(this.challenge.currentScore, this.challenge.mate, moveScore, moveMate);
            result.correct = Math.abs(compare.categoryDiff) < 2;
            result.classification = compare.classification;

            if (result.correct) {
                let ratingChange = this.getRatingChange(this.positionRating, this.challenge.rating, true, compare.normalizeDiff);
                this.challenge.ratingChanges.push(ratingChange);

                result.curMoveResult = this.chess.makeMove(move);
                this.challenge.moveCount++;
                if (this.challenge.moveCount < this.challenge.maxMoves && result.curMoveResult.gameStatus === GAME_STATUS.INPROGRESS) {
                    let analysis = await this.chessAnalysis.requestAnalysis({input: this.chess.movesSAN});
                    result.nextMoveResult = this.chess.makeMove(analysis.move);
                    
                    analysis = await this.chessAnalysis.requestAnalysis({input: this.chess.movesSAN});
                    this.challenge.currentScore = analysis.eval;
                    this.challenge.bestMove = analysis.move;
                    this.challenge.mate = analysis.mate ? Number(analysis.mate) : null;
                } else {
                    result.solved = this.solved = true;
                    if (this.pass === null) {
                        result.pass = this.pass = true;
                        const sum = this.challenge.ratingChanges.reduce((acc, value) => acc + value, 0);
                        result.ratingChange = Math.round(sum / this.challenge.ratingChanges.length);
                        this.positionRating = Math.min(3600, this.positionRating + result.ratingChange);
                    }
                }
            } else {
                result.solved = this.solved = false;
                if (this.pass === null) {
                    result.pass = this.pass = false;
                    result.ratingChange = this.getRatingChange(this.positionRating, this.challenge.rating, this.pass);
                    this.positionRating = Math.max(0, this.positionRating + result.ratingChange);
                }
            }
        }
        return result;
    }
}
