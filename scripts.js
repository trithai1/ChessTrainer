import * as spec from "./spec.js";
import * as svg_utils from "./svg_utils.js";
import {DEFAULT_FEN, PIECE_COLOR, CHECK_STATE, GAME_STATUS, PIECE_BY_FEN, CHESS_PIECE} from "../../Logicore/chess_constants.js";
import * as utils from "../../Logicore/utils.js";
import ChessChallenge from "./chessChallenge.js";
import Chess from "../Logicore/chess.js";

const clamp = (min, num, max) => Math.min(Math.max(num, min), max);

const moveSound = new Audio("./assets/move.mp3");
const captureSound = new Audio("./assets/capture.mp3");
const castleSound = new Audio("./assets/castle.mp3");
const promotionSound = new Audio("./assets/promotion.mp3");
const checkSound = new Audio("./assets/check.mp3");

const promotionOverlay = document.getElementById("promotion-overlay");
const qPromotion = document.getElementById("promotion-q");
const nPromotion = document.getElementById("promotion-n");
const rPromotion = document.getElementById("promotion-r");
const bPromotion = document.getElementById("promotion-b");

const challenge = new ChessChallenge();
await challenge.load();

promotionOverlay.onclick = () => {
    promotionOverlay.style.display = "none";
};

function openPromotionOverlay(move) {
    promotionOverlay.style.display = "grid";
    const options = [qPromotion, nPromotion, rPromotion, bPromotion];
    const increment = move.to.row <= 4 ? 1 : -1;
    let row = move.to.row;
    const [color, img] = chess.activeColor == PIECE_COLOR.WHITE ? ["w", "white_piece_frame.png"] : ["b", "black_piece_frame.png"];
    for (const option of options) {
        option.style.backgroundImage = `url(assets/img/${img})`;
        const promotionPiece = option.querySelector(".promotion-piece");
        promotionPiece.className = color + promotionPiece.className.slice(1);
        option.style.gridRow = row + 1;
        option.style.gridColumn = move.to.col + 1;
        row += increment;
    }

    qPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        move.promotion = CHESS_PIECE.QUEEN;
        performChallengeMove(move);
    };

    nPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        move.promotion = CHESS_PIECE.KNIGHT;
        performChallengeMove(move);
    };

    rPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        move.promotion = CHESS_PIECE.ROOK;
        performChallengeMove(move);
    };

    bPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        move.promotion = CHESS_PIECE.BISHOP;
        performChallengeMove(move);
    }
}

const chessContainer = document.getElementById("chess-container");
const chessGrid = document.getElementById("chess-grid");

let prevClassName, prevRow, prevCol, pieceType, chessGridBounds;
let draggingPiece = null, selectedPiece = null;
let offSetY = 0;
let offSetX = 0;

function removeHelpers() {
    const highlightHelpers = document.getElementsByClassName("helper");
    [...highlightHelpers].forEach(element => element.remove());
}

function addHelpers(chess, row, col) {
    // add a highlight div to the board where you clicked. and helper x
    // for now just add highlight
    const highlightHelper = document.createElement("div");
    highlightHelper.className = "helper piece-highlight";
    highlightHelper.style.gridRow = row + 1;
    highlightHelper.style.gridColumn = col + 1;
    highlightHelper.zIndex = spec.PAGE_INDEX.HELPER;
    chessGrid.appendChild(highlightHelper);

    const moves = chess.moves([row, col]);
    for (let i = 0; i < moves.length; i++) {
        const [_row, _col] = moves[i];
        const castle = chess.getCastle();
        if (_row == null && _col == true) { // castle kingside
            moves.push([row, col + 2]);
            moves.push([row, castle.kingside.rook.col]);
            continue;
        }
        else if (_row == true && _col == null) { // castle queenside
            moves.push([row, col - 2]);
            moves.push([row, castle.queenside.rook.col]);
            continue;
        }

        const moveHelper = document.createElement("div");
        
        if (chess.isOpenSquare(_row, _col)) {
            const moveCircle = document.createElement("div");
            moveCircle.className = "helper move-circle";
            moveCircle.zIndex = spec.PAGE_INDEX.HELPER;
            moveHelper.append(moveCircle);
        } else {
            const captureMark = document.createElement("img");
            captureMark.className = "helper capture-mark";
            captureMark.src = "assets/img/capture_mark.png";
            captureMark.zIndex = spec.PAGE_INDEX.HELPER;
            moveHelper.append(captureMark);
        }

        moveHelper.addEventListener("mousedown", event => {});

        moveHelper.className = "helper piece-move";
        moveHelper.style.gridRow = _row + 1;
        moveHelper.style.gridColumn = _col + 1;
        moveHelper.zIndex = spec.PAGE_INDEX.HELPER;
        chessGrid.appendChild(moveHelper);
    }
}

function removeMoveHighlight() {
    const moveHighlight = document.getElementsByClassName("move-highlight");
    [...moveHighlight].forEach(element => element.remove());
}

function addMoveHighlight(prevRow, prevCol, row, col) {
    // if valid, add a permanent highlight div to prev position and new position
    // for now just add the highlight, skip validations
    let highlightHelper = document.createElement("div");
    highlightHelper.className = "move-highlight";
    highlightHelper.style.gridRow = prevRow + 1;
    highlightHelper.style.gridColumn = prevCol + 1;
    highlightHelper.zIndex = spec.PAGE_INDEX.HELPER;
    chessGrid.appendChild(highlightHelper);

    highlightHelper = document.createElement("div");
    highlightHelper.className = "move-highlight";
    highlightHelper.style.gridRow = row + 1;
    highlightHelper.style.gridColumn = col + 1;
    highlightHelper.zIndex = spec.PAGE_INDEX.HELPER;
    chessGrid.appendChild(highlightHelper);
}

function fenToChessboard(fen=DEFAULT_FEN) {
    const [piecePlacement, activeColor, castlingRights, enPassantTarget, halfMove, fullMove] = fen.split(" ");
    
    let row = 0, col = 0, cssPiece;
    for (const char of piecePlacement) {
        if (utils.isDigit(char)) {
            col += Number(char);
            continue;
            
        } else if (char === '/') {
            row++;
            col = 0;
            continue;
        }

        const isChessPiece = utils.isLower(char) || utils.isUpper(char);
        if (!isChessPiece) { continue; }

        const pieceColor = PIECE_BY_FEN[char].color;
        cssPiece = utils.fenToCssPiece(char);
        const chessPiece = document.createElement("div");
        chessPiece.className = `piece ${cssPiece} cell-${row}-${col}`;
        chessPiece.style.gridRow = row + 1;
        chessPiece.style.gridColumn = col + 1;
        chessPiece.style.zIndex = spec.PAGE_INDEX.PIECE;

        chessPiece.addEventListener("mousedown", event => {
            event.preventDefault(); // Prevent text selection
            if (event.button != 0 || pieceColor !== challenge.chess.activeColor || challenge.chess.gameStatus !== GAME_STATUS.INPROGRESS) { return; }
            // The bug should be fixed, but this is still just in case anything happens with mouseup not triggering.
            // Just an extra layer of protection.
            if (draggingPiece !== null) {
                draggingPiece.className = prevClassName;
                draggingPiece.style.gridRow = prevRow + 1;
                draggingPiece.style.gridColumn = prevCol + 1;
                draggingPiece.style.transform = "";
                draggingPiece.style.zIndex = spec.PAGE_INDEX.PIECE;
                draggingPiece = null;
                return;
            }

            draggingPiece = chessPiece;

            const rect = chessPiece.getBoundingClientRect();
            chessGridBounds = chessGrid.getBoundingClientRect();

            offSetX = rect.left + rect.width/2;
            offSetY = rect.top + rect.height/2;

            pieceType = chessPiece.classList[1];
            prevClassName = chessPiece.className;
            prevRow = Number(chessPiece.style.gridRow) - 1;
            prevCol = Number(chessPiece.style.gridColumn) - 1;
            chessPiece.classList.add("dragging");
            chessPiece.style.zIndex = spec.PAGE_INDEX.DRAGGING_PIECE;

            removeHelpers();
            if (challenge.chess.isActivePiece(prevRow, prevCol)) {
                addHelpers(challenge.chess, prevRow, prevCol);
            }
        });
        chessGrid.appendChild(chessPiece);
        col++;
    }
}

// Board Events
// --------------

document.addEventListener("mousemove", event => {
    if (!draggingPiece) return;

    const x = clamp(chessGridBounds.left, event.clientX, chessGridBounds.right) - offSetX;
    const y = clamp(chessGridBounds.top, event.clientY, chessGridBounds.bottom) - offSetY;

    draggingPiece.style.transform = `translate(${x}px, ${y}px)`;
    draggingPiece.style.rotate = "0deg";
    draggingPiece.style.scale = 1;
});

function getChessPiece(chess, row, col, piece=null) {
    piece ||= chess.getPiece(row, col);
    return document.getElementsByClassName(`piece ${piece.css} cell-${row}-${col}`)[0];
}

function revertPiece(chess, row, col, piece=null) {
    piece ||= getChessPiece(chess, row, col);
    piece.className = prevClassName;
    piece.style.gridRow = row + 1;
    piece.style.gridColumn = col + 1;
    piece.style.transform = "";
    piece.style.zIndex = spec.PAGE_INDEX.PIECE;
}

function performPieceMove(chess, move) {
    move = chess.parseChessMove(move);
    const piece = getChessPiece(chess, move.from.row, move.from.col);
    const moveResult = chess.makeMove(move);
    if (!moveResult.success) {
        // selectedPiece = move.to.row === move.from.row && move.to.col === move.from.col ? piece : null;
        revertPiece(chess, move.from.row, move.from.col, piece);
        return false;
    }

    const castle = moveResult.kingsideCastle ?? moveResult.queensideCastle ?? null;
    if (castle) {
        piece.className = `piece ${castle.king.piece.css} cell-${castle.king.row}-${castle.kingFile}`;
        piece.style.gridRow = castle.king.row + 1;
        piece.style.gridColumn = castle.kingFile + 1;
        piece.style.transform = "";
        piece.style.zIndex = spec.PAGE_INDEX.PIECE;

        const rookPiece = getChessPiece(chess, castle.rook.row, castle.rook.col);
        rookPiece.className = `piece ${castle.rook.piece.css} cell-${castle.rook.row}-${castle.rookFile}`;
        rookPiece.style.gridRow = castle.rook.row + 1;
        rookPiece.style.gridColumn = castle.rookFile + 1;
        rookPiece.style.transform = "";
        rookPiece.style.zIndex = spec.PAGE_INDEX.PIECE;
    } else {
        piece.className = `piece ${moveResult.piece.css} cell-${move.to.row}-${move.to.col}`;
        piece.style.gridRow = move.to.row + 1;
        piece.style.gridColumn = move.to.col + 1;
        piece.style.transform = "";
        piece.style.zIndex = spec.PAGE_INDEX.PIECE;
        
        if (moveResult.promotion)
            piece.className = `piece ${moveResult.promotion.css} cell-${move.to.row}-${move.to.col}`;
    }

    if (moveResult.captured) {
        const capturedPiece = getChessPiece(chess, moveResult.captured.row, moveResult.captured.col, moveResult.captured.piece);
        capturedPiece.remove();
    }

    playSound(moveResult);
    
    // is win/lose/draw
    if (moveResult.gameStatus === GAME_STATUS.WHITE_WIN) { alert("WHITE WINS!"); }
    else if (moveResult.gameStatus === GAME_STATUS.BLACK_WIN) { alert("BLACK WINS!"); }
    else if (moveResult.gameStatus === GAME_STATUS.DRAW) { alert("DRAW."); }

    if (move.to.row != move.from.row || move.to.col != move.from.col){
        removeHelpers();
        removeMoveHighlight();
        addMoveHighlight(move.from.row, move.from.col, move.to.row, move.to.col);
    }
    return true;
}

function performChallengeMove(move) {
    move = challenge.chess.parseChessMove(move);
    let evaluation;
    if (challenge.chess.verifyMove(move)) {
        evaluation = challenge.evaluateMove(move);
        if (!evaluation.isCorrect) {
            console.log("Bad Move!");
            revertPiece(challenge.chess, move.from.row, move.from.col);
            return false;
        }
    }
    
    performPieceMove(challenge.chess, move);
    if (evaluation.isSolved) console.log("You Solved it!");
    else console.log("Good Move!");

    if (evaluation.nextMove) performPieceMove(challenge.chess, evaluation.nextMove);
}

function playSound(moveResult) {
    if (moveResult.checkState !== null) {
        checkSound.play();
    } else if (moveResult.kingsideCastle || moveResult.queensideCastle) {
        castleSound.play();
    } else if (moveResult.promotion) {
        promotionSound.play();
    } else if (moveResult.captured) {
        captureSound.play();
    } else {
        moveSound.play();
    }
}

window.addEventListener("mouseup", event => {
    if (!draggingPiece) return;

    let row = Math.floor((event.clientY - chessGridBounds.top) / (chessGridBounds.height/8));
    let col = Math.floor((event.clientX - chessGridBounds.left) / (chessGridBounds.width/8));

    const move = {
        from: {row: prevRow, col: prevCol},
        to: {row: row, col: col},
        promotion: null,
    }

    if (challenge.chess.isPromotion(move)) {
        selectedPiece = draggingPiece;
        draggingPiece.className = prevClassName;
        draggingPiece.style.gridRow = prevRow + 1;
        draggingPiece.style.gridColumn = prevCol + 1;
        draggingPiece.style.transform = "";
        draggingPiece.style.zIndex = spec.PAGE_INDEX.PIECE;
        openPromotionOverlay(move);
        draggingPiece = null;
        return;
    }
    performChallengeMove(move);
    draggingPiece = null;
});

document.addEventListener("mousedown", event => {
    event.preventDefault(); // Prevent text selection
    if (event.button != 0) { return; }
    removeHelpers();
    svg_utils.removeAllSVG();
}, true);

chessGrid.addEventListener("contextmenu", event => { event.preventDefault(); });

// SVG Drawing Events
// -------------------

let drawing = false;
let startRow, startCol, endRow, endCol;

chessGrid.addEventListener("mousedown", event => {
    event.preventDefault(); // Prevent text selection
    if (event.button != 2) { return; }

    chessGridBounds = chessGrid.getBoundingClientRect();
    startRow = endRow = Math.floor((event.clientY - chessGridBounds.top)/ (chessGridBounds.height/8));
    startCol = endCol = Math.floor((event.clientX - chessGridBounds.left) / (chessGridBounds.width/8));
    svg_utils.drawCircle(startRow, startCol, "dragging");
    drawing = true;
});

chessGrid.addEventListener("mousemove", event => {
    if (!drawing) { return; }
    const row = Math.floor((event.clientY - chessGridBounds.top)/ (chessGridBounds.height/8));
    const col = Math.floor((event.clientX - chessGridBounds.left) / (chessGridBounds.width/8));

    if (row === endRow && col === endCol ) { return; }
    endRow = row;
    endCol = col;
    svg_utils.removeDraggingSVG();
    svg_utils.draw(startRow, startCol, endRow, endCol, "dragging");
});

window.addEventListener("mouseup", event => {
    if (event.button != 2) { return; }
    drawing = false;
    svg_utils.finalizeDraggingSVG();
});

const nextChallengeEl = document.getElementById("next-challenge");
const getFenEl = document.getElementById("get-fen");

getFenEl.onclick = (event) => {
    console.log(challenge.chess.getFen());
};

function removeChessPieces() {
    chessGrid.querySelectorAll(".piece").forEach(element => element.remove());
}

function setupChallenge() {
    challenge.nextChallenge();
    removeChessPieces();
    removeHelpers();
    svg_utils.removeAllSVG();

    let chess, firstMove;
    if (challenge.challenge.type === ChessChallenge.PUZZLE) {
        chess = new Chess(challenge.challenge.puzzle.fen);
        firstMove = challenge.challenge.puzzle.moves[0];
    }
    else {
        chess = new Chess();
        challenge.challenge.position.moves.slice(0, -1).forEach(entry => chess.makeMove(entry.move));
        firstMove = challenge.challenge.position.moves.at(-1).move;
    }

    fenToChessboard(chess.getFen());
    performPieceMove(chess, firstMove);
}
setupChallenge();

nextChallengeEl.addEventListener("click", setupChallenge);