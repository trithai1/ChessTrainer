import * as utils from "./utils.js";
import {GAME_STATUS, CHECK_STATE, CHESS_PIECE, FEN_PIECE, FEN_PIECE_KEY, CASTLING_KEY, PIECE_COLOR, DEFAULT_FEN, PIECE, PIECE_BY_FEN, COORDS_ALPHA} from "./chess_constants.js";

export default class Chess {
    static charFiles = {a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7};
    static pawnProp = {
        WHITE_INIT: 6,
        BLACK_INIT: 1,
        WHITE_FORWARD: -1,
        BLACK_FORWARD: 1,
    }
    static castleProp = {
        KINGSIDE_KING_FILE: 6,
        QUEENSIDE_KING_FILE: 2,
        KINGSIDE_ROOK_FILE: 5,
        QUEENSIDE_ROOK_FILE: 3,
    }

    constructor(fen=DEFAULT_FEN) {
        this.king = {white: null, black: null};
        this.castleRook = {white: {king: null, queen: null}, black: {king: null, queen: null}};
        this.n = 8;
        this.setup(fen);
        this.checkState = this._getCheckState();
        this.gameStatus = this._getGameStatus();
        
        this.initialFen = fen;
        this.movesUCI = [];
        this.movesSAN = [];
    }

    setup(fen) {
        const [piecePlacement, activeColor, castlingRights, enPassantTarget, halfMove, fullMove] = fen.split(" ");
        this.board = Array(64).fill(null);
        this.activeColor = activeColor === 'w' ? PIECE_COLOR.WHITE : PIECE_COLOR.BLACK;
        this.enPassantTarget = enPassantTarget === '-' ? null : this._parseChessCoords(enPassantTarget);
        this.halfMove = Number(halfMove);  // resets to 0 after pawn move or piece capture. increments after every move
        this.fullMove = Number(fullMove);  // increments after every black move. does not reset

        this.castle = {
            white: {
                kingside: {
                    rook: {piece: PIECE.WHITE_ROOK, row: 7, col: 7},
                    key: CASTLING_KEY.WHITE_KINGSIDE,
                    available: false,
                },
                queenside: {
                    rook: {piece: PIECE.WHITE_ROOK, row: 7, col: 0},
                    key: CASTLING_KEY.WHITE_QUEENSIDE,
                    available: false,
                },
            },
            black: {
                kingside: {
                    rook: {piece: PIECE.BLACK_ROOK, row: 0, col: 7},
                    key: CASTLING_KEY.BLACK_KINGSIDE,
                    available: false,
                },
                queenside: {
                    rook: {piece: PIECE.BLACK_ROOK, row: 0, col: 0},
                    key: CASTLING_KEY.BLACK_QUEENSIDE,
                    available: false,
                },
            },
        }

        for (const fenPiece of castlingRights) {
            switch (fenPiece) {
                case FEN_PIECE.WHITE_KING:
                    this.castle.white.kingside.available = true;
                    break;
                case FEN_PIECE.WHITE_QUEEN:
                    this.castle.white.queenside.available = true;
                    break;
                case FEN_PIECE.BLACK_KING:
                    this.castle.black.kingside.available = true;
                    break;
                case FEN_PIECE.BLACK_QUEEN:
                    this.castle.black.queenside.available = true;
                    break;
            }
        }


        let idx = 0, row = 0;
        this.pieceCount = Array(12).fill(0);
        for (const fenPiece of piecePlacement) {
            if (utils.isDigit(fenPiece)) {
                idx += Number(fenPiece);
                continue;
                
            } else if (fenPiece === '/') {
                row += 1;
                idx = row * this.n;
                continue;
            } else if (fenPiece === FEN_PIECE.WHITE_KING) {
                const col = idx - (row * this.n);
                this.king.white = {piece: PIECE.WHITE_KING, row: row, col: col};
            } else if (fenPiece === FEN_PIECE.BLACK_KING) {
                const col = idx - (row * this.n);
                this.king.black = {piece: PIECE.BLACK_KING, row: row, col: col};
            }

            this.board[idx++] = fenPiece;
            this.pieceCount[FEN_PIECE_KEY[fenPiece]] += 1;
        }

        if (this.king.white === null || this.king.black === null) {
            throw new Error("Missing King/s!");
        }

        this.pieceKeys = Array.from({length: 12}, () => Array.from({length: 64}, this._random64));
        this.turnKey = this._random64();
        this.castlingKeys = Array.from({length: 4}, this._random64);
        this.enPassantKeys = Array.from({length: this.n}, this._random64);

        this.hash = this._calculateHash();
        this.transpositionTable = new Map();
        this._updateTranspositionTable();
        this.threeFold = false;
    }

    save() {
        return {
            fen: this.getFen(),
            initialFen: this.initialFen,
            movesUCI: [...this.movesUCI],
            movesSAN: [...this.movesSAN],
        };
    }

    restore(state) {
        this.setup(state.fen);
        this.initialFen = state.initialFen || DEFAULT_FEN;
        this.movesUCI = state.movesUCI || [];
        this.movesSAN = state.movesSAN || [];

        this.checkState = this._getCheckState();
        this.gameStatus = this._getGameStatus();
    }

    idx(row, col) { return row * this.n + col; }

    getFen() {
        const rows = [];
        for (let rank = 0; rank < this.n; rank++) {
            let row = "";
            let empty = 0;

            for (let file = 0; file < this.n; file++) {
                const piece = this.board[rank * this.n + file];
                if (piece === null) { empty++; }
                else {
                    if (empty) row += empty;
                    empty = 0;
                    row += piece;
                }
            }

            if (empty) row += empty;
            rows.push(row);
        }
        
        const piecePlacement = rows.join('/');
        const activeColor = this.activeColor === PIECE_COLOR.WHITE ? 'w' : 'b';
        const castlingList = [[this.castle.white.kingside.available, 'K'], [this.castle.white.queenside.available, 'Q'], [this.castle.black.kingside.available, 'k'], [this.castle.black.queenside.available, 'q']];
        const casltingRights = castlingList.filter(([available, _]) => available).map(([_, fen]) => fen).join('') || '-';
        const enPassantTarget = this.enPassantTarget ? this.parseToUCISquare(this.enPassantTarget) : '-';
        
        return `${piecePlacement} ${activeColor} ${casltingRights} ${enPassantTarget} ${this.halfMove} ${this.fullMove}`
    }

    printBoard() {
        const pieces = {
            K: "♚", Q: "♛", R: "♜",
            B: "♝", N: "♞", P: "♟",
            k: "♔", q: "♕", r: "♖",
            b: "♗", n: "♘", p: "♙",
            ".": "·"
        };
        console.log("   " + Array.from({ length: this.n }, (_, i) => i).join("  "));

        for (let row = 0; row < this.n; row++) {
            const squares = this.board
                .slice(row * this.n, (row + 1) * this.n)
                .map(square => pieces[square] ?? "·");

            console.log(`${row}  ${squares.join("  ")}`);
        }
    }

    sameMove(move1, move2) {
        return this.parseToUCINotation(move1) === this.parseToUCINotation(move2);
    }
    
    getPiece(row, col) {
        return PIECE_BY_FEN[this.board[this.idx(row, col)]] ?? null;
    }

    isActivePiece(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece) { return null; }
        return piece.color === this.activeColor;
    }

    getCastle() {
        return this.activeColor == PIECE_COLOR.WHITE ? this.castle.white : this.castle.black;
    }

    isOpenSquare(row, col) {
        const piece = this.board[this.idx(row, col)];
        return piece === null;
    }

    isKing(row, col) {
        const piece = this.getPiece(row, col);
        return piece.type === CHESS_PIECE.KING;
    }

    isPawn(row, col) {
        const piece = this.getPiece(row, col);
        return piece.type === CHESS_PIECE.PAWN;
    }

    isPromotion(move) {
        move = this.parseChessMove(move);
        const piece = this.getPiece(move.from.row, move.from.col);
        if (!piece) { return false; }
        const promotionRow = piece.color === PIECE_COLOR.WHITE ? 0 : this.n - 1;
        return piece.type === CHESS_PIECE.PAWN && move.to.row === promotionRow;
    }

    call_draw() {
        if (self.halfMove === 100) {
            this.gameStatus = GAME_STATUS.DRAW;
        }
    }

    _extractSAN(notation) {
        let text = String(notation).trim();

        // Remove PGN tags, comments, variations, and line comments.
        // Nested variations and brace comments are supported.
        let output = "";
        let braces = 0;
        let parentheses = 0;
        let tags = 0;
        let lineComment = false;

        for (const char of text) {
            if (char === "\n") {
                lineComment = false;

                if (!braces && !parentheses && !tags) {
                    output += " ";
                }

                continue;
            }

            if (lineComment) continue;

            if (braces) {
                if (char === "{") braces++;
                if (char === "}") braces--;
                continue;
            }

            if (char === "{") {
                braces++;
                continue;
            }

            if (char === ";" && !parentheses && !tags) {
                lineComment = true;
                continue;
            }

            if (parentheses) {
                if (char === "(") parentheses++;
                if (char === ")") parentheses--;
                continue;
            }

            if (char === "(") {
                parentheses++;
                continue;
            }

            if (tags) {
                if (char === "]") tags--;
                continue;
            }

            if (char === "[") {
                tags++;
                continue;
            }

            output += char;
        }

        // Remove numeric annotation glyphs.
        output = output.replace(/\$\d+/g, " ");

        // Remove standalone en passant markers.
        output = output.replace(/\be\.?\s*p\.?/gi, " ");

        // Remove move numbers, e.g. 1. / 1... / 23...
        output = output.replace(/\b\d+\.(?:\.\.)?/g, " ");

        // Remove standalone result tokens.
        output = output.replace(
            /(?:^|\s)(?:1-0|0-1|1\/2-1\/2|½-½|\*)(?=\s|$)/g,
            " "
        );

        const tokens = output.trim().split(/\s+/).filter(Boolean);

        if (!tokens.length) {
            throw new Error("No chess move found");
        }

        return tokens[0];
    }

    _canMoveTo(from, to) {
        const moves = this.moves(from);
        return moves.some(move => {
            const destination = this._parseChessCoords(move);
            return destination.row === to.row && destination.col === to.col;
        });
    }

    _parseSANNotation(notation) {
        // Extract the first move, ignoring PGN metadata.
        let san = this._extractSAN(notation);

        // Remove check, checkmate, annotations, and draw offers.
        san = san
            .replace(/(?:\+|#|[!?])+$/g, "")
            .replace(/=$/, "");

        // Normalize castling (also accepts zeroes).
        san = san.replace(/0/g, "O");

        // Castling
        if (/^O-O(?:-O)?$/i.test(san)) {
            const isKingside = san.toUpperCase() === "O-O";
            const castlePosition = isKingside
                ? {row: null, col: true}
                : {row: true, col: null}
            const kingPosition = this.activeColor === PIECE_COLOR.WHITE
                ? structuredClone(this.king.white)
                : structuredClone(this.king.black);
            
            return {
                from: kingPosition,
                to: castlePosition,
                promotion: null
            };
        }

        // SAN:
        // Piece, disambiguation, capture, destination, promotion
        const match = san.match(
            /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/
        );

        if (!match) {
            throw new Error(`Invalid chess notation: ${san}`);
        }

        const [
            ,
            designation,
            file,
            rank,
            capture,
            destination,
            promotion
        ] = match;

        const type = (designation || "P").toUpperCase();
        const to = this._parseChessCoords(destination);

        const candidates = [];

        // Find every piece that matches the notation.
        const isActiveColor = this.activeColor === PIECE_COLOR.WHITE ? utils.isUpper : utils.isLower;
        for (let i = 0; i < 64; i++) {
            const piece = this.board[i];

            if (!piece || piece.toUpperCase() !== type || !isActiveColor(piece)) continue;

            const from = this._parseChessCoords(i);

            // File disambiguation
            if (file && from.col !== Chess.charFiles[file.toLowerCase()]) continue;

            // Rank disambiguation
            if (rank && from.row !== this.n - Number(rank)) continue;

            // SAN pawn captures must specify their source file.
            if (type === "P" && capture && !file) continue;

            // SAN pawn advances shouldn't specify a source file.
            if (type === "P" && !capture && file) continue;

            // Check legal moves.
            if (!this._canMoveTo(from, to)) continue;

            candidates.push({
                from,
                to,
                promotion: promotion?.toUpperCase() ?? null
            });
        }

        if (candidates.length === 0) {
            throw new Error(`No legal move found for: ${san}`);
        }

        if (candidates.length > 1) {
            throw new Error(`Ambiguous chess move: ${san}`);
        }

        return candidates[0];
    }

    _parseChessNotation(notation) {
        const move = notation.trim();

        // UCI: e2e4, g1f3, a2a1q
        const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
        if (uciPattern.test(move)) {
            return this._parseUCINotation(move.toLowerCase());
        }

        return this._parseSANNotation(move);
    }

    parseChessMove(move) {
        if (typeof move === "string") return this._parseChessNotation(move);

        move = {
            from: this._parseChessCoords(move.from),
            to: this._parseChessCoords(move.to),
            promotion: move.promotion ? move.promotion.toLowerCase() : null,
        }
        return move;
    }

    _parseUCINotation(notation) {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(notation)) {
            throw new Error(`Invalid UCI notation: ${notation}`);
        }

        const from = this._parseChessCoords(notation.slice(0, 2));
        let to = this._parseChessCoords(notation.slice(2, 4));
        
        const king = this.activeColor === PIECE_COLOR.WHITE
            ? this.king.white
            : this.king.black;
        
        if (from.row === king.row && from.col === king.col && Math.abs(to.col - king.col) >= 2) {
            const isKingside = to.col - king.col > 0;
            const castlePosition = isKingside
                    ? {row: null, col: true}
                    : {row: true, col: null}
            
            to = castlePosition;
        }

        return {
            from,
            to,
            promotion: notation[4] || null,
        };
    }

    parseToUCISquare(square) {
        return String.fromCharCode(97 + square.col) + (this.n - square.row);
    }

    parseToUCINotation(move) {
        const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
        if (typeof move === "string" && uciPattern.test(move)) {
            return move;
        }
        
        const moveObj = this.parseChessMove(move);
        if (typeof moveObj !== "object" || moveObj === null || Array.isArray(moveObj)) {
            throw new Error(`Invalid square: ${square}`);
        }
        return this.parseToUCISquare(moveObj.from) + this.parseToUCISquare(moveObj.to) + (moveObj.promotion?.toLowerCase ?? "");
    }

    parseToSANNotation(move) {
        const { from, to, promotion } = move;

        // Castling
        if (to.row === null && to.col === true) return "O-O";
        if (to.row === true && to.col === null) return "O-O-O";

        const piece = this.getPiece(from.row, from.col);
        if (!piece) throw new Error("No piece at source square");

        const target = this.getPiece(to.row, to.col);

        const file = col => "abcdefgh"[col];
        const rank = row => String(8 - row);
        const square = pos => file(pos.col) + rank(pos.row);

        // Captures
        const enPassant =
            piece.type === CHESS_PIECE.PAWN &&
            from.col !== to.col &&
            target === null;
        
        const capture = target !== null || enPassant;

        // Piece letter (pawns have no letter)
        let san = piece.type === "P" ? "" : piece.type;

        // Disambiguation
        if (piece.type !== CHESS_PIECE.PAWN) {
            const alternatives = this.board.reduce((acc, fen, idx) => {
                const square = this._parseChessCoords(idx);
                const isItself = square.row === from.row && square.col === from.col;
                if (fen !== piece.fen || isItself) return acc;

                const moves = this.moves(square);
                if (!moves.some(([row, col]) => row === to.row && col === to.col)) return acc;

                acc.push(square);
                return acc;
            }, []);

            if (alternatives.length > 0) {
                const sameFile = alternatives.some(({_, col}) => col === from.col);
                const sameRank = alternatives.some(({row, _}) => row === from.row);

                if (!sameFile) san += file(from.col);
                else if (!sameRank) san += rank(from.row);
                else san += square(from);
            }
        }

        // Pawn captures include originating file
        if (piece.type === CHESS_PIECE.PAWN && capture) {
            san += file(from.col);
        }

        // Capture symbol
        if (capture) san += "x";

        // Destination square
        san += square(to);

        // Promotion
        if (promotion) san += "=" + promotion.toUpperCase();

        // Check / Checkmate - requires temporarily applying the move
        const state = this.save();

        try {
            const result = this.applyMove(move);
            if (result.gameStatus === GAME_STATUS.WHITE_WIN || result.gameStatus === GAME_STATUS.BLACK_WIN) {
                san += "#";
            } else if (result.checkState === CHECK_STATE.WHITE_IN_CHECK || result.checkState === CHECK_STATE.BLACK_IN_CHECK) {
                san += "+";
            }
        } finally {
            this.restore(state);
        }
        return san;
    }

    verifyMove(input) {
        const move = this.parseChessMove(input);

        const movePiece = this.getPiece(move.from.row, move.from.col);
        if (movePiece.type === CHESS_PIECE.KING) {
            [move.to.row, move.to.col] = this._processKingMove(move.from.row, move.from.col, move.to.row, move.to.col);
        }
        
        if (!this._verifyMove(move.from.row, move.from.col, move.to.row, move.to.col, movePiece, move.promotion)) {
            return false;
        }
        return true;
    }

    makeMove(input) {
        const move = this.parseChessMove(input);
        const san = this.parseToSANNotation(move);
        
        const moveResult = this.applyMove(move);
        if (moveResult.success) {
            this.movesSAN.push(san);
            this.movesUCI.push(this.parseToUCINotation(move));
        }
        return moveResult;
    }

    applyMove(move) {
        let promotion = move.promotion;

        const movePiece = this.getPiece(move.from.row, move.from.col);
        if (movePiece.type === CHESS_PIECE.KING) {
            [move.to.row, move.to.col] = this._processKingMove(move.from.row, move.from.col, move.to.row, move.to.col);
        }

        const moveResult = {
            success: false,
            color: this.activeColor,
            from: move.from,
            to: move.to,
            piece: null,
            san: null,
            captured: null,
            checkState: null,
            gameStatus: null,
            canDraw: this.halfMove >= 50,
            pawnDouble: false, // pawn double move
            enPassant: false, // is enpassant capture
            promotion: null, // promotion piece or null
            kingsideCastle: null, // king side castle {king, rook, kingFile, rookFile}
            queensideCastle: null, // queen side castle {king, rook, kingFile, rookFile}
            msg: null,
        };
        
        moveResult.piece = movePiece;
        if (!this._verifyMove(move.from.row, move.from.col, move.to.row, move.to.col, moveResult.piece, promotion)) {
            moveResult.msg = `Invalid Move: (${move.from.row},${move.from.col})->(${move.to.row},${move.to.col}) promo: ${promotion}`;
            return moveResult;
        }
        
        if (move.to.row === null && move.to.col === true) { // kingside castle
            const kingPiece = moveResult.piece;
            const [castle, king] = this.activeColor === PIECE_COLOR.WHITE ? [this.castle.white, this.king.white] : [this.castle.black, this.king.black];
            const rook = castle.kingside.rook;
            
            this.board[this.idx(move.from.row, move.from.col)] = null;
            this.board[this.idx(rook.row, rook.col)] = null;
            this._updateHash(this.pieceKeys[kingPiece.key][this.idx(move.from.row, move.from.col)]);
            this._updateHash(this.pieceKeys[rook.piece.key][this.idx(rook.row, rook.col)]);

            this.board[this.idx(move.from.row, Chess.castleProp.KINGSIDE_KING_FILE)] = kingPiece.fen;
            this.board[this.idx(rook.row, Chess.castleProp.KINGSIDE_ROOK_FILE)] = rook.piece.fen;
            this._updateHash(this.pieceKeys[kingPiece.key][this.idx(move.from.row, Chess.castleProp.KINGSIDE_KING_FILE)]);
            this._updateHash(this.pieceKeys[rook.piece.key][this.idx(rook.row, Chess.castleProp.KINGSIDE_ROOK_FILE)]);
            king.row = move.from.row; king.col = Chess.castleProp.KINGSIDE_KING_FILE;
            castle.kingside.available = false;
            castle.queenside.available = false;
            moveResult.kingsideCastle = {
                king: {piece: kingPiece, row: move.from.row, col: move.from.col},
                rook: {...rook},
                kingFile: Chess.castleProp.KINGSIDE_KING_FILE,
                rookFile: Chess.castleProp.KINGSIDE_ROOK_FILE,
            }
        } else if (move.to.row === true && move.to.col === null) { // queenside castle
            const kingPiece = moveResult.piece;
            const [castle, king] = this.activeColor === PIECE_COLOR.WHITE ? [this.castle.white, this.king.white] : [this.castle.black, this.king.black];
            const rook = castle.queenside.rook;
            
            this.board[this.idx(move.from.row, move.from.col)] = null;
            this.board[this.idx(rook.row, rook.col)] = null;
            this._updateHash(this.pieceKeys[kingPiece.key][this.idx(move.from.row, move.from.col)]);
            this._updateHash(this.pieceKeys[rook.piece.key][this.idx(rook.row, rook.col)]);

            this.board[this.idx(move.from.row, Chess.castleProp.QUEENSIDE_KING_FILE)] = kingPiece.fen;
            this.board[this.idx(rook.row, Chess.castleProp.QUEENSIDE_ROOK_FILE)] = rook.piece.fen;
            this._updateHash(this.pieceKeys[kingPiece.key][this.idx(move.from.row, Chess.castleProp.QUEENSIDE_KING_FILE)]);
            this._updateHash(this.pieceKeys[rook.piece.key][this.idx(rook.row, Chess.castleProp.QUEENSIDE_ROOK_FILE)]);
            king.row = move.from.row; king.col = Chess.castleProp.QUEENSIDE_KING_FILE;
            castle.kingside.available = false;
            castle.queenside.available = false;
            moveResult.queensideCastle = {
                king: {piece: kingPiece, row: move.from.row, col: move.from.col},
                rook: {...rook},
                kingFile: Chess.castleProp.QUEENSIDE_KING_FILE,
                rookFile: Chess.castleProp.QUEENSIDE_ROOK_FILE,
            }
        } else {
            const toPiece = this.getPiece(move.to.row, move.to.col);
            
            if (promotion) {
                promotion = movePiece.color === PIECE_COLOR.WHITE ? PIECE_BY_FEN[promotion.toUpperCase()] : PIECE_BY_FEN[promotion.toLowerCase()];
            }
            const newPiece = promotion ? promotion : movePiece;
            
            this.board[this.idx(move.from.row, move.from.col)] = null;
            this.board[this.idx(move.to.row, move.to.col)] = newPiece.fen;

            this._updateHash(this.pieceKeys[movePiece.key][this.idx(move.from.row, move.from.col)]);
            this._updateHash(this.pieceKeys[newPiece.key][this.idx(move.to.row, move.to.col)]);

            if (toPiece) {
                this._updateHash(this.pieceKeys[toPiece.key][this.idx(move.to.row, move.to.col)]);
                this.pieceCount[toPiece.key] -= 1;
                moveResult.captured = {piece: toPiece, row: move.to.row, col: move.to.col};
            }

            if (promotion) {
                this.pieceCount[movePiece.key] -= 1;
                this.pieceCount[newPiece.key] += 1;
                moveResult.promotion = promotion;
            }

            const isEnPassant = movePiece.type === CHESS_PIECE.PAWN && this.enPassantTarget !== null && move.to.row === this.enPassantTarget.row && move.to.col === this.enPassantTarget.col;
            if (isEnPassant) {
                const pawnPiece = this.getPiece(move.from.row, move.to.col);
                this._updateHash(this.pieceKeys[pawnPiece.key][this.idx(move.from.row, move.to.col)]);
                this.board[this.idx(move.from.row, move.to.col)] = null;
                this.pieceCount[pawnPiece.key] -= 1;
                moveResult.enPassant = true;
                moveResult.captured = {piece: pawnPiece, row: move.from.row, col: move.to.col};
            }

            if (movePiece.type === CHESS_PIECE.PAWN && Math.abs(move.from.row - move.to.row) === 2) {
                this.enPassantTarget = {row: Number((move.from.row + move.to.row) / 2), col: move.to.col};
                this._updateHash(this.enPassantKeys[this.enPassantTarget.col]);
                moveResult.pawnDouble = true;
            } else if (this.enPassantTarget) {
                this._updateHash(this.enPassantKeys[this.enPassantTarget.col]);
                this.enPassantTarget = null;
            }

            // King moved state update
            if (movePiece.fen === FEN_PIECE.WHITE_KING) {
                this.king.white.row = move.to.row; this.king.white.col = move.to.col;
                if (this.castle.white.kingside.available) {
                    this.castle.white.kingside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.WHITE_KINGSIDE]);
                }
                if (this.castle.white.queenside.available) {
                    this.castle.white.queenside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.WHITE_QUEENSIDE]);
                }
            } else if (movePiece.fen === FEN_PIECE.BLACK_KING) {
                this.king.black.row = move.to.row; this.king.black.col = move.to.col;
                if (this.castle.black.kingside.available) {
                    this.castle.black.kingside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.BLACK_KINGSIDE]);
                }
                if (this.castle.black.queenside.available) {
                    this.castle.black.queenside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.BLACK_QUEENSIDE]);
                }
            }

            // Rook move/captured state update
            const moveKRook = movePiece.fen === FEN_PIECE.WHITE_ROOK;
            const capturedKRook = moveResult.captured?.piece.type ?? null === FEN_PIECE.WHITE_ROOK;
            if (this.castle.white.kingside.available) {
                const moveWKingside = move.from.row === this.castle.white.kingside.rook.row && move.from.col === this.castle.white.kingside.rook.col;
                const capturedWKingside = move.to.row === this.castle.white.kingside.rook.row && move.to.col === this.castle.white.kingside.rook.col;
                if (moveKRook && moveWKingside || capturedKRook && capturedWKingside) {
                    this.castle.white.kingside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.WHITE_KINGSIDE]);
                }
            }
            if (this.castle.white.queenside.available) {
                const moveQueenside = move.from.row === this.castle.white.queenside.rook.row && move.from.col === this.castle.white.queenside.rook.col;
                const capturedQueenside = move.to.row === this.castle.white.queenside.rook.row && move.to.col === this.castle.white.queenside.rook.col;
                if (moveKRook && moveQueenside || capturedKRook && capturedQueenside) {
                    this.castle.white.queenside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.WHITE_QUEENSIDE]);
                }
            }
            
            const moveQRook = movePiece.fen === FEN_PIECE.BLACK_ROOK;
            const capturedQRook = moveResult.captured?.piece.type ?? null === FEN_PIECE.BLACK_ROOK;
            if (this.castle.black.kingside.available) {
                const moveBKingside = move.from.row === this.castle.black.kingside.rook.row && move.from.col === this.castle.black.kingside.rook.col;
                const capturedBKingside = move.to.row === this.castle.black.kingside.rook.row && move.to.col === this.castle.black.kingside.rook.col;
                if (moveQRook && moveBKingside || capturedQRook && capturedBKingside) {
                    this.castle.black.kingside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.BLACK_KINGSIDE]);
                }
            }
            if (this.castle.black.queenside.available) {
                const moveBQueenside = move.from.row === this.castle.black.queenside.rook.row && move.from.col === this.castle.black.queenside.rook.col;
                const capturedBQueenside = move.to.row === this.castle.black.queenside.rook.row && move.to.col === this.castle.black.queenside.rook.col;
                if (moveQRook && moveBQueenside || capturedQRook && capturedBQueenside) {
                    this.castle.black.queenside.available = false;
                    this._updateHash(this.castlingKeys[CASTLING_KEY.BLACK_QUEENSIDE]);
                }
            }
        }

        this.halfMove = moveResult.captured || movePiece.type === CHESS_PIECE.PAWN ? 0 : this.halfMove + 1;
        this.fullMove += this.activeColor === PIECE_COLOR.BLACK ? 1 : 0;
        this.activeColor = !this.activeColor;
        this._updateHash(this.turnKey);

        this.insufficientMaterial = this._isInsufficientMaterial();
        const entry = this._updateTranspositionTable();
        if (entry.count >= 3) { this.threeFold = true; }

        this.checkState = this._getCheckState();
        this.gameStatus = this._getGameStatus();

        Object.assign(moveResult, {
            success: true,
            san: null,
            checkState: this.checkState,
            gameStatus: this.gameStatus,
            canDraw: this.halfMove >= 50,
            promotion: promotion ? promotion : null,
        });
        return moveResult;
    }

    moves(square, piece=undefined) {
        let possibleMoves = [];
        let {row, col} = this._parseChessCoords(square);
        if (!(0 <= row && row < this.n && 0 <= col && col < this.n) || this.gameStatus != GAME_STATUS.INPROGRESS && this.gameStatus !== undefined) { return possibleMoves; }
        piece ||= this.getPiece(row, col);

        if (!piece || piece.color != this.activeColor) { return possibleMoves; }

        switch (piece.fen) {
            case FEN_PIECE.WHITE_KING:
            case FEN_PIECE.BLACK_KING:
                possibleMoves = this._getKingMoves(row, col, piece.color);
                break;
            case FEN_PIECE.WHITE_QUEEN:
            case FEN_PIECE.BLACK_QUEEN:
                possibleMoves = this._getHorizontalMoves(row, col, piece.color);
                possibleMoves = possibleMoves.concat(this._getDiagonalMoves(row, col, piece.color));
                break;
            case FEN_PIECE.WHITE_ROOK:
            case FEN_PIECE.BLACK_ROOK:
                possibleMoves = this._getHorizontalMoves(row, col, piece.color);
                break;
            case FEN_PIECE.WHITE_BISHOP:
            case FEN_PIECE.BLACK_BISHOP:
                possibleMoves = this._getDiagonalMoves(row, col, piece.color);
                break;
            case FEN_PIECE.WHITE_KNIGHT:
            case FEN_PIECE.BLACK_KNIGHT:
                possibleMoves = this._getKnightMoves(row, col, piece.color);
                break;
            case FEN_PIECE.WHITE_PAWN:
            case FEN_PIECE.BLACK_PAWN:
                possibleMoves = this._getPawnMoves(row, col, piece.color);
                break;
        }

        // if it is the king being moved, you can skip the potential danger step. that should already be taken care of.
        if (piece.type === CHESS_PIECE.KING) { return possibleMoves; }
        
        // if king will be in potential danger, filter only moves that'll keep the king safe
        const dangerPieces = this.getKingAttackersAfterRemoval(row, col);
        if (dangerPieces.length) { // if dangers, only keep legal moves that keeps king defended
            if (dangerPieces.length >= 2) { return []; }
            const king = this.activeColor === PIECE_COLOR.WHITE ? this.king.white : this.king.black;
            const [dangerPiece, dangerRow, dangerCol] = dangerPieces[0];

            const knightFilter = ([row, col]) => row === dangerRow && col === dangerCol;

            const drow = dangerRow - king.row;
            const dcol = dangerCol - king.col;
            const pieceFilter = ([row, col]) => {
                const dr = row - king.row;
                const dc = col - king.col;

                const notSameDirection = Math.sign(dr) != Math.sign(drow) || Math.sign(dc) != Math.sign(dcol);
                const notMatchingDiagonal = Math.abs(drow) === Math.abs(dcol) && Math.abs(dr) != Math.abs(dc);
                const notInRange = Math.abs(dr) > Math.abs(drow) || Math.abs(dc) > Math.abs(dcol);
                if (notSameDirection || notMatchingDiagonal || notInRange) { return false; }
                return true;
            };
            possibleMoves = possibleMoves.filter(dangerPiece.type === CHESS_PIECE.KNIGHT ? knightFilter : pieceFilter);
        }
        return possibleMoves;
    }

    _processKingMove(fromRow, fromCol, toRow, toCol) {
        if (toRow === null || toCol === null) { return [toRow, toCol]; }
        
        const castle = this.activeColor === PIECE_COLOR.WHITE ? this.castle.white : this.castle.black;
        if (castle.kingside.available && (toCol - fromCol === 2 || toRow === castle.kingside.rook.row && toCol === castle.kingside.rook.row)) { return [null, true]; }
        else if (castle.queenside.available && (toCol - fromCol === -2 || toRow === castle.queenside.rook.row && toCol === castle.queenside.rook.row)) { return [true, null]; }
        return [toRow, toCol];
    }

    _calculateHash() {
        let hash = 0n;

        for (let i = 0; i < 64; i++) {
            const piece = PIECE_BY_FEN[this.board[i]] ?? null;
            if (piece) {
                hash ^= this.pieceKeys[piece.key][i];
            }
        }

        if (this.activeColor === PIECE_COLOR.BLACK) { hash ^= this.turnKey; }

        const castlingRights = [this.castle.white.kingside, this.castle.white.queenside, this.castle.black.kingside, this.castle.black.queenside]
        for (let i = 0; i < 4; i++) {
            if (castlingRights[i].available) { hash ^= this.castlingKeys[i]; }
        }

        if (this.enPassantTarget) { hash ^= this.enPassantKeys[this.enPassantTarget.col]; }

        return hash;
    }

    _random64() {
        const bytes = new Uint32Array(2);
        crypto.getRandomValues(bytes);
        return (BigInt(bytes[0]) << 32n) | BigInt(bytes[1]);
    }

    _updateTranspositionTable() {
        let entry = this.transpositionTable.get(this.hash);
        if (entry) {
            entry.count += 1;
        } else {
            this.transpositionTable.set(this.hash, { count: 1 });
            entry = this.transpositionTable.get(this.hash);
        }
        return entry;
    }

    _updateHash(key) {
        this.hash ^= key;
    }

    _isInsufficientMaterial() {
        const getCount = (fenPiece) => this.pieceCount[FEN_PIECE_KEY[fenPiece]];
        if (
            getCount(FEN_PIECE.WHITE_PAWN) ||
            getCount(FEN_PIECE.BLACK_PAWN) ||
            getCount(FEN_PIECE.WHITE_ROOK) ||
            getCount(FEN_PIECE.BLACK_ROOK) ||
            getCount(FEN_PIECE.WHITE_QUEEN) ||
            getCount(FEN_PIECE.BLACK_QUEEN) ||
            getCount(FEN_PIECE.WHITE_BISHOP) >= 2 ||
            getCount(FEN_PIECE.BLACK_BISHOP) >= 2 ||
            getCount(FEN_PIECE.WHITE_KNIGHT) >= 2 ||
            getCount(FEN_PIECE.BLACK_KNIGHT) >= 2 ||
            getCount(FEN_PIECE.WHITE_BISHOP) && getCount(FEN_PIECE.WHITE_KNIGHT) ||
            getCount(FEN_PIECE.BLACK_BISHOP) && getCount(FEN_PIECE.BLACK_KNIGHT)
        ) { return false; }

        if (getCount(FEN_PIECE.WHITE_BISHOP) && getCount(FEN_PIECE.BLACK_BISHOP)) {
            let whiteBishop, blackBishop;
            for (let row = 0; row < this.n; row++) {
                for (let col = 0; col < this.n; col++) {
                    if (this.board[row][col] === FEN_PIECE.WHITE_BISHOP) { whiteBishop = {row, col}; }
                    else if (this.board[row][col] === FEN_PIECE.BLACK_BISHOP) { blackBishop = {row, col}; }
                }
            }

            const sameColorBishop = (whiteBishop.row + whiteBishop.col) % 2 === (blackBishop.row + blackBishop.col) % 2;
            if (!sameColorBishop) return false;
        }

        return true;
    }

    _getCheckState() {
        // check if active color king is in danger
        const [king, pieceColor, in_check] = this.activeColor === PIECE_COLOR.WHITE
            ? [this.king.white, PIECE_COLOR.WHITE, CHECK_STATE.WHITE_IN_CHECK]
            : [this.king.black, PIECE_COLOR.BLACK, CHECK_STATE.BLACK_IN_CHECK];
        
        const dangerPieces = this._isDanger(king.row, king.col, pieceColor, true);
        if (dangerPieces.length) {
            return in_check;
        }
        return null;
    }

    _getGameStatus() {
        const [inCheck, endStatus, king] = this.activeColor === PIECE_COLOR.WHITE
            ? [this.checkState === CHECK_STATE.WHITE_IN_CHECK, GAME_STATUS.BLACK_WIN, this.king.white]
            : [this.checkState === CHECK_STATE.BLACK_IN_CHECK, GAME_STATUS.WHITE_WIN, this.king.black];

        let status = this.moves([king.row, king.col]).length ? GAME_STATUS.INPROGRESS : GAME_STATUS.DRAW;
        for (let i = 0; i < this.board.length; i++) {
            if (status === GAME_STATUS.INPROGRESS) { break; }
            
            const piece = PIECE_BY_FEN[this.board[i]] ?? null;
            if (piece && piece.color === this.activeColor && this.moves(i).length) { status = GAME_STATUS.INPROGRESS; }
        }
        if (status === GAME_STATUS.DRAW && inCheck) { return endStatus; }
        else if (status === GAME_STATUS.DRAW) { return GAME_STATUS.DRAW; }

        if (this.halfMove >= 75 || this.threeFold || this.insufficientMaterial) { return GAME_STATUS.DRAW; }
        return GAME_STATUS.INPROGRESS;
    }

    getKingAttackersAfterRemoval(row, col) {
        const board = [...this.board];
        board[this.idx(row, col)] = null;
        
        const king = this.activeColor === PIECE_COLOR.WHITE ? this.king.white : this.king.black;
        const dangerPieces = this._isDanger(king.row, king.col, this.activeColor, true, board);
        return dangerPieces
    }

    _getPieceColor(piece) { return utils.isUpper(piece) ? PIECE_COLOR.WHITE : PIECE_COLOR.BLACK; }

    _parseChessCoords(square) {
        let row, col;
        if (Array.isArray(square)) {
            [row, col] = square;
        } else if (typeof square === "object" && square !== null) {
            row = square.row;
            col = square.col;
        } else if (Number.isFinite(square)) {
            row = Math.floor(Number(square / this.n));
            col = square - (row * this.n);
        } else if (typeof square === "string" && !utils.isDigit(square[0])) {
            row = this.n - Number(square[1]);
            col = Chess.charFiles[square[0]];
        } else {
            throw new Error(`Invalid square: ${square}`);
        }
        return {row, col};
    }

    _getHorizontalMoves(row, col, piece_color) {
        const possibleMoves = [];
        let left = col - 1, right = col + 1, up = row + 1, down = row - 1;
        let leftPiece = left >= 0 ? this.board[this.idx(row, left)] : undefined;
        let rightPiece = right < this.n ? this.board[this.idx(row, right)] : undefined;
        let upPiece = up < this.n ? this.board[this.idx(up, col)] : undefined;
        let downPiece = down >= 0 ? this.board[this.idx(down, col)] : undefined;
        while (leftPiece !== undefined || rightPiece !== undefined || upPiece !== undefined || downPiece !== undefined) {
            const checkList = [[row, left, leftPiece], [row, right, rightPiece], [up, col, upPiece], [down, col, downPiece]];
            for (let i = 0; i < 4; i++) {
                const [_row, _col, piece] = checkList[i];
                if (piece === undefined) { continue; }
                else if (piece === null) {
                    possibleMoves.push([_row, _col]);
                } else {
                    if (this._getPieceColor(piece) != piece_color) { possibleMoves.push([_row, _col]); }
                    
                    if (i === 0) { leftPiece = undefined; }
                    else if (i === 1) { rightPiece = undefined; }
                    else if (i === 2) { upPiece = undefined; }
                    else if (i === 3) { downPiece = undefined; }
                }
            }

            left--, right++, up++, down--;
            leftPiece = leftPiece !== undefined && left >= 0 ? this.board[this.idx(row, left)] : undefined;
            rightPiece = rightPiece !== undefined && right < this.n ? this.board[this.idx(row, right)] : undefined;
            upPiece = upPiece !== undefined && up < this.n ? this.board[this.idx(up, col)] : undefined;
            downPiece = downPiece !== undefined && down >= 0 ? this.board[this.idx(down, col)] : undefined;
        }
        return possibleMoves;
    }

    _getDiagonalMoves(row, col, piece_color) {
        const possibleMoves = [];
        let left = col - 1, right = col + 1, up = row + 1, down = row - 1;
        let nwPiece = up < this.n && left >= 0 ? this.board[this.idx(up, left)] : undefined;
        let nePiece = up < this.n && right < this.n ? this.board[this.idx(up, right)] : undefined;
        let swPiece = down >= 0 && left >= 0 ? this.board[this.idx(down, left)] : undefined;
        let sePiece = down >= 0 && right < this.n ? this.board[this.idx(down, right)] : undefined;
        while (nwPiece !== undefined || nePiece !== undefined || swPiece !== undefined || sePiece !== undefined) {
            const checkList = [[up, left, nwPiece], [up, right, nePiece], [down, left, swPiece], [down, right, sePiece]];
            for (let i = 0; i < 4; i++) {
                const [_row, _col, piece] = checkList[i];
                if (piece === undefined) { continue; }
                else if (piece === null) {
                    possibleMoves.push([_row, _col]);
                } else {
                    if (this._getPieceColor(piece) != piece_color) { possibleMoves.push([_row, _col]); }
                    
                    if (i === 0) { nwPiece = undefined; }
                    else if (i === 1) { nePiece = undefined; }
                    else if (i === 2) { swPiece = undefined; }
                    else if (i === 3) { sePiece = undefined; }
                }
            }

            left--, right++, up++, down--;
            nwPiece = nwPiece !== undefined && up < this.n && left >= 0 ? this.board[this.idx(up, left)] : undefined;
            nePiece = nePiece !== undefined && up < this.n && right < this.n ? this.board[this.idx(up, right)] : undefined;
            swPiece = swPiece !== undefined && down >= 0 && left >= 0 ? this.board[this.idx(down, left)] : undefined;
            sePiece = sePiece !== undefined && down >= 0 && right < this.n ? this.board[this.idx(down, right)] : undefined;
        }
        return possibleMoves;
    }

    _getKingMoves(row, col, piece_color) {
        // check 8 directions
        const squares = [[row - 1, col - 1], [row - 1, col], [row - 1, col + 1], [row, col - 1], [row, col + 1], [row + 1, col - 1], [row + 1, col], [row + 1, col + 1]];
        const possibleMoves = [];
        const board = [...this.board];
        board[this.idx(row, col)] = null;
        for (const [_row, _col] of squares) {
            if (!(0 <= _row && _row < this.n && 0 <= _col && _col < this.n)) { continue; }
            const piece = this.getPiece(_row, _col);
            const availableSpace = piece === null || piece.color != piece_color; // empty or enemy piece
            if (availableSpace && !this._isDanger(_row, _col, piece_color, false, board).length) { possibleMoves.push([_row, _col]); }
        }

        // check castle if available and no squares being attaked from king to new king spot
        let [qCastle, kCastle, isAlly, inCheck] = piece_color === PIECE_COLOR.WHITE
            ? [this.castle.white.queenside, this.castle.white.kingside, utils.isUpper, CHECK_STATE.WHITE_IN_CHECK]
            : [this.castle.black.queenside, this.castle.black.kingside, utils.isLower, CHECK_STATE.BLACK_IN_CHECK];
        
        if (qCastle.available) {
            let canCastle = true;
            for (let _col = col-1; _col > qCastle.rook.col; _col--) {
                const piece = this.getPiece(row, _col);
                const isAllyPiece = piece != null && isAlly(piece.fen);
                const isKingPathDanger = _col >= Chess.castleProp.QUEENSIDE_KING_FILE && this._isDanger(row, _col, piece_color, false, board).length;
                if (this.checkState === inCheck || isKingPathDanger || isAllyPiece) {
                    canCastle = false;
                    break;
                }
            }
            if (canCastle) { possibleMoves.push([true, null]); }
        }

        if (kCastle.available) {
            let canCastle = true;
            for (let _col = col+1; _col < kCastle.rook.col; _col++) {
                const piece = this.getPiece(row, _col);
                const isAllyPiece = piece != null && isAlly(piece.fen);
                const isKingPathDanger = _col <= Chess.castleProp.KINGSIDE_KING_FILE && this._isDanger(row, _col, piece_color, false, board).length;
                if (this.checkState === inCheck || isKingPathDanger || isAllyPiece) {
                    canCastle = false;
                    break;
                }
            }
            if (canCastle) { possibleMoves.push([null, true]); }
        }
        return possibleMoves;
    }

    _getKnightMoves(row, col, piece_color) {
        const squares = [[row - 2, col - 1], [row - 2, col + 1], [row - 1, col - 2], [row - 1, col + 2], [row + 1, col - 2], [row + 1, col + 2], [row + 2, col - 1], [row + 2, col + 1]];
        const possibleMoves = [];
        for (const [_row, _col] of squares) {
            if (!(0 <= _row && _row < this.n && 0 <= _col && _col < this.n)) { continue; }
            const piece = this.getPiece(_row, _col);
            const availableSpace = piece === null || piece.color != piece_color; // empty or enemy piece
            if (availableSpace) { possibleMoves.push([_row, _col]); }
        }
        return possibleMoves;
    }
    
    _getPawnMoves(row, col, piece_color) {
        const squares = piece_color === PIECE_COLOR.WHITE ? [[row - 1, col], [row - 2, col], [row - 1, col - 1], [row - 1, col + 1]] : [[row + 1, col], [row + 2, col], [row + 1, col - 1], [row + 1, col + 1]];
        const possibleMoves = [];
        for (let i = 0; i < 4; i++) {
            const [_row, _col] = squares[i];
            if (!(0 <= _row && _row < this.n && 0 <= _col && _col < this.n)) { continue; }
            const piece = this.getPiece(_row, _col);
            
            const emptySpace = piece === null;
            if (i === 0) {
                if (emptySpace) { possibleMoves.push([_row, _col]); }
            }
            else if (i === 1) {
                const pawnInit = piece_color === PIECE_COLOR.WHITE ? Chess.pawnProp.WHITE_INIT : Chess.pawnProp.BLACK_INIT;
                if (row === pawnInit && emptySpace && this.board[this.idx(squares[0][0], squares[0][1])] === null) {
                    possibleMoves.push([_row, _col]);
                }
            } else {
                const enemySpace = !emptySpace && piece.color != piece_color;
                const isEnPassant = this.enPassantTarget != null && _row === this.enPassantTarget.row && _col === this.enPassantTarget.col;
                if (enemySpace || isEnPassant) { possibleMoves.push([_row, _col]); }
            }
        }
        return possibleMoves;
    }

    _verifyMove(fromRow, fromCol, toRow, toCol, piece, promotion) {
        const fromInBounds = 0 <= fromRow && fromRow < this.n && 0 <= fromCol && fromCol < this.n;
        const toInBounds = 0 <= toRow && toRow < this.n && 0 <= toCol && toCol < this.n;
        const pawnInit = this.activeColor === PIECE_COLOR.WHITE ? Chess.pawnProp.WHITE_INIT : Chess.pawnProp.BLACK_INIT;
        if (
            !fromInBounds || !toInBounds ||
            fromRow === toRow && fromCol === toCol ||
            this.gameStatus != GAME_STATUS.INPROGRESS ||
            piece.type === CHESS_PIECE.PAWN && toRow === pawnInit && ![CHESS_PIECE.QUEEN, CHESS_PIECE.ROOK, CHESS_PIECE.KNIGHT, CHESS_PIECE.BISHOP].includes(promotion)
        ) { return false; }

        const possibleMoves = this.moves([fromRow, fromCol], piece);
        for (const [row, col] of possibleMoves) {
            if (row === toRow && col === toCol) { return true; }
        }
        return false;
    }

    _isDanger(row, col, pieceColor, deepSearch=false, board=this.board) {
        let dangerPieces = [];
        dangerPieces = dangerPieces.concat(this._isHorizontalDanger(row, col, pieceColor, deepSearch, board));
        if (!deepSearch && dangerPieces.length) { return dangerPieces; }
        
        dangerPieces = dangerPieces.concat(this._isDiagonalDanger(row, col, pieceColor, deepSearch, board));
        if (!deepSearch && dangerPieces.length) { return dangerPieces; }
        
        dangerPieces = dangerPieces.concat(this._isKnightDanger(row, col, pieceColor, deepSearch, board));
        if (!deepSearch && dangerPieces.length) { return dangerPieces; }
        return dangerPieces;
    }

    _isHorizontalDanger(row, col, pieceColor, deepSearch=false, board=this.board) {
        const dangerPieces = [];
        const [danger, kingDanger] = pieceColor === PIECE_COLOR.WHITE
            ? [[FEN_PIECE.BLACK_QUEEN, FEN_PIECE.BLACK_ROOK], FEN_PIECE.BLACK_KING]
            : [[FEN_PIECE.WHITE_QUEEN, FEN_PIECE.WHITE_ROOK], FEN_PIECE.WHITE_KING];

        let left = col - 1, right = col + 1, up = row + 1, down = row - 1;
        let leftPiece = left >= 0 ? board[this.idx(row, left)] : undefined;
        let rightPiece = right < this.n ? board[this.idx(row, right)] : undefined;
        let upPiece = up < this.n ? board[this.idx(up, col)] : undefined;
        let downPiece = down >= 0 ? board[this.idx(down, col)] : undefined;
        while (leftPiece !== undefined || rightPiece !== undefined || upPiece !== undefined || downPiece !== undefined) {
            const checkList = [[row, left, leftPiece], [row, right, rightPiece], [up, col, upPiece], [down, col, downPiece]];
            for (let i = 0; i < 4; i++) {
                const [_row, _col, piece] = checkList[i];
                if (!piece) { continue; }
                else if (
                    (piece === kingDanger && Math.abs(_row - row) <= 1 && Math.abs(_col - col) <= 1) ||
                    danger.includes(piece)
                ) {
                    dangerPieces.push([PIECE_BY_FEN[piece], _row, _col]);
                    if (!deepSearch) { return dangerPieces; }
                }
                
                if (piece !== null) {  // stop searching that direction if piece found
                    if (i === 0) { leftPiece = undefined; }
                    else if (i === 1) { rightPiece = undefined; }
                    else if (i === 2) { upPiece = undefined; }
                    else if (i === 3) { downPiece = undefined; }
                }
            }

            left--, right++, up++, down--;
            leftPiece = leftPiece !== undefined && left >= 0 ? board[this.idx(row, left)] : undefined;
            rightPiece = rightPiece !== undefined && right < this.n ? board[this.idx(row, right)] : undefined;
            upPiece = upPiece !== undefined && up < this.n ? board[this.idx(up, col)] : undefined;
            downPiece = downPiece !== undefined && down >= 0 ? board[this.idx(down, col)] : undefined;
        }
        return dangerPieces;
    }

    _isDiagonalDanger(row, col, pieceColor, deepSearch=false, board=this.board) {
        const dangerPieces = [];
        const [danger, kingDanger, pawnDanger, pawnForward] = pieceColor === PIECE_COLOR.WHITE
            ? [[FEN_PIECE.BLACK_QUEEN, FEN_PIECE.BLACK_BISHOP], FEN_PIECE.BLACK_KING, FEN_PIECE.BLACK_PAWN, Chess.pawnProp.BLACK_FORWARD]
            : [[FEN_PIECE.WHITE_QUEEN, FEN_PIECE.WHITE_BISHOP], FEN_PIECE.WHITE_KING, FEN_PIECE.WHITE_PAWN, Chess.pawnProp.WHITE_FORWARD]

        let left = col - 1, right = col + 1, up = row + 1, down = row - 1;
        let nwPiece = up < this.n && left >= 0 ? board[this.idx(up, left)] : undefined;
        let nePiece = up < this.n && right < this.n ? board[this.idx(up, right)] : undefined;
        let swPiece = down >= 0 && left >= 0 ? board[this.idx(down, left)] : undefined;
        let sePiece = down >= 0 && right < this.n ? board[this.idx(down, right)] : undefined;
        while (nwPiece !== undefined || nePiece !== undefined || swPiece !== undefined || sePiece !== undefined) {
            const checkList = [[up, left, nwPiece], [up, right, nePiece], [down, left, swPiece], [down, right, sePiece]];
            for (let i = 0; i < 4; i++) {
                const [_row, _col, piece] = checkList[i];
                if (!piece) { continue; }
                else if (
                    (piece === kingDanger && Math.abs(_row - row) <= 1 && Math.abs(_col - col) <= 1) ||
                    (piece === pawnDanger && (_row + pawnForward) === row && Math.abs(_col - col) === 1) ||
                    (danger.includes(piece))
                ) {
                    dangerPieces.push([PIECE_BY_FEN[piece], _row, _col]);
                    if (!deepSearch) { return dangerPieces; }
                }

                if (piece !== null) {  // stop searching that direction if piece found
                    if (i === 0) { nwPiece = undefined; }
                    else if (i === 1) { nePiece = undefined; }
                    else if (i === 2) { swPiece = undefined; }
                    else if (i === 3) { sePiece = undefined; }
                }
            }

            left--, right++, up++, down--;
            nwPiece = nwPiece !== undefined && up < this.n && left >= 0 ? board[this.idx(up, left)] : undefined;
            nePiece = nePiece !== undefined && up < this.n && right < this.n ? board[this.idx(up, right)] : undefined;
            swPiece = swPiece !== undefined && down >= 0 && left >= 0 ? board[this.idx(down, left)] : undefined;
            sePiece = sePiece !== undefined && down >= 0 && right < this.n ? board[this.idx(down, right)] : undefined;
        }
        return dangerPieces;
    }

    _isKnightDanger(row, col, pieceColor, deepSearch=false, board=this.board) {
        const dangerPieces = [];
        const danger = pieceColor === PIECE_COLOR.WHITE ? FEN_PIECE.BLACK_KNIGHT : FEN_PIECE.WHITE_KNIGHT;
        const squares = [[row - 2, col - 1], [row - 2, col + 1], [row - 1, col - 2], [row - 1, col + 2], [row + 1, col - 2], [row + 1, col + 2], [row + 2, col - 1], [row + 2, col + 1]];
        for (const [_row, _col] of squares) {
            if (!(0 <= _row && _row < this.n && 0 <= _col && _col < this.n)) { continue; }
            const piece = board[this.idx(_row, _col)];
            if (!piece) { continue; }
            else if (piece === danger) {
                dangerPieces.push([PIECE_BY_FEN[piece], _row, _col]);
                if (!deepSearch) { return dangerPieces; }
            }
        }
        return dangerPieces;
    }
}