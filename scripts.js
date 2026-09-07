import * as spec from "./spec.js";
import * as svg_utils from "./svg_utils.js";
import {DEFAULT_FEN, PIECE_COLOR, CHECK_STATE, GAME_STATUS, PIECE_BY_FEN, CHESS_PIECE} from "../Logicore/chess_constants.js";
import * as utils from "../Logicore/utils.js";
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

promotionOverlay.onclick = () => {
    promotionOverlay.style.display = "none";
};

function openPromotionOverlay(piece, fromRow, fromCol, toRow, toCol) {
    promotionOverlay.style.display = "grid";
    const options = [qPromotion, nPromotion, rPromotion, bPromotion];
    const increment = toRow <= 4 ? 1 : -1;
    let row = toRow;
    const [color, img] = chess.activeColor == PIECE_COLOR.WHITE ? ["w", "white_piece_frame.png"] : ["b", "black_piece_frame.png"];
    for (const option of options) {
        option.style.backgroundImage = `url(assets/img/${img})`;
        const promotionPiece = option.querySelector(".promotion-piece");
        promotionPiece.className = color + promotionPiece.className.slice(1);
        option.style.gridRow = row + 1;
        option.style.gridColumn = toCol + 1;
        row += increment;
    }

    qPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        performPieceMove(piece, fromRow, fromCol, toRow, toCol, CHESS_PIECE.QUEEN);
    };

    nPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        performPieceMove(piece, fromRow, fromCol, toRow, toCol, CHESS_PIECE.KNIGHT);
    };

    rPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        performPieceMove(piece, fromRow, fromCol, toRow, toCol, CHESS_PIECE.ROOK);
    };

    bPromotion.onclick = () => {
        promotionOverlay.style.display = "none";
        performPieceMove(piece, fromRow, fromCol, toRow, toCol, CHESS_PIECE.BISHOP);
    };
}

const chessContainer = document.getElementById("chess-container");
const chessGrid = document.getElementById("chess-grid");

let prevClassName, prevRow, prevCol, pieceType, chessGridBounds;
let draggingPiece = null, selectedPiece = null;
let offSetY = 0;
let offSetX = 0;

let chess = new Chess();

function removeHelpers() {
    const highlightHelpers = document.getElementsByClassName("helper");
    [...highlightHelpers].forEach(element => element.remove());
}

function addHelpers(row, col) {
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
    for (let char of piecePlacement) {
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
            if (event.button != 0 || pieceColor !== chess.activeColor || chess.gameStatus !== GAME_STATUS.INPROGRESS) { return; }
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
            if (chess.isActivePiece(prevRow, prevCol)) {
                addHelpers(prevRow, prevCol);
            }
        });
        chessGrid.appendChild(chessPiece);
        col++;
    }
}

fenToChessboard();

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

function performPieceMove(piece, fromRow, fromCol, toRow, toCol, promotion=null) {
    const moveResult = chess.move([fromRow, fromCol], [toRow, toCol], promotion);
    if (!moveResult.success) {
        // selectedPiece = toRow === fromRow && toCol === fromCol ? piece : null;
        piece.className = prevClassName;
        piece.style.gridRow = fromRow + 1;
        piece.style.gridColumn = fromCol + 1;
        piece.style.transform = "";
        piece.style.zIndex = spec.PAGE_INDEX.PIECE;
        return false;
    }

    const castle = moveResult.kingsideCastle ?? moveResult.queensideCastle ?? null;
    if (castle) {
        toRow = castle.king.row; toCol = castle.kingFile;
        piece.className = `piece ${castle.king.piece.css} cell-${toRow}-${toCol}`;
        piece.style.gridRow = castle.king.row + 1;
        piece.style.gridColumn = castle.kingFile + 1;
        piece.style.transform = "";
        piece.style.zIndex = spec.PAGE_INDEX.PIECE;

        const rookPiece = document.getElementsByClassName(`piece ${castle.rook.piece.css} cell-${castle.rook.row}-${castle.rook.col}`)[0];
        rookPiece.className = `piece ${castle.rook.piece.css} cell-${castle.rook.row}-${castle.rookFile}`;
        rookPiece.style.gridRow = castle.rook.row + 1;
        rookPiece.style.gridColumn = castle.rookFile + 1;
        rookPiece.style.transform = "";
        rookPiece.style.zIndex = spec.PAGE_INDEX.PIECE;
    } else {
        piece.className = `piece ${moveResult.piece.css} cell-${toRow}-${toCol}`;
        piece.style.gridRow = toRow + 1;
        piece.style.gridColumn = toCol + 1;
        piece.style.transform = "";
        piece.style.zIndex = spec.PAGE_INDEX.PIECE;
    }

    if (moveResult.captured) {
        const capturedPieces = document.getElementsByClassName(`piece ${moveResult.captured.piece.css} cell-${moveResult.captured.row}-${moveResult.captured.col}`);
        [...capturedPieces].forEach(element => element.remove());
    }

    if (moveResult.promotion) {
        piece.className = `piece ${moveResult.promotion.css} cell-${toRow}-${toCol}`;
    }

    playSound(moveResult);
    
    // is win/lose/draw
    if (moveResult.gameStatus === GAME_STATUS.WHITE_WIN) { alert("WHITE WINS!"); }
    else if (moveResult.gameStatus === GAME_STATUS.BLACK_WIN) { alert("BLACK WINS!"); }
    else if (moveResult.gameStatus === GAME_STATUS.DRAW) { alert("DRAW."); }

    if (toRow != fromRow || toCol != fromCol){
        removeHelpers();
        removeMoveHighlight();
        addMoveHighlight(fromRow, fromCol, toRow, toCol);
    }
    return true;
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

    if (chess.isPromotion(prevRow, prevCol, row, col)) {
        selectedPiece = draggingPiece;
        draggingPiece.className = prevClassName;
        draggingPiece.style.gridRow = prevRow + 1;
        draggingPiece.style.gridColumn = prevCol + 1;
        draggingPiece.style.transform = "";
        draggingPiece.style.zIndex = spec.PAGE_INDEX.PIECE;
        openPromotionOverlay(draggingPiece, prevRow, prevCol, row, col);
        draggingPiece = null;
        return;
    }
    performPieceMove(draggingPiece, prevRow, prevCol, row, col);
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

const nextPosition = document.getElementById("next-position");
const getFen = document.getElementById("get-fen");

getFen.onclick = (event) => {
    console.log(chess.getFen());
};

const positions = [
    "r1bqkbnr/pppp1ppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R b KQkq - 2 3",
    DEFAULT_FEN,
    "r1b1kbnr/pp3ppp/2np4/8/5B2/5N2/PPP1PPPP/RN2KB1R w KQkq - 0 7",
    "r1b1k2r/pp3ppp/2n2n2/4b3/8/2N5/PPP1PPPP/2KR1B1R b kq - 3 10",
    "3r1rk1/1p3ppp/p1n2n2/4bb2/8/2NBP2P/PPP2PP1/2KRR3 b - - 0 14",
]

function removeChessPieces() {
    chessGrid.querySelectorAll(".piece").forEach(element => element.remove());
}

function randomPoolNumber(pool, n) {
    if (pool.length === 0) {
        pool = Array.from({length: n}, (_, i) => i);
    }

    const randIdx = Math.floor(Math.random() * pool.length);
    const value = pool.splice(randIdx, 1)[0];
    return [pool, value];
}

let pool = [], value;
nextPosition.onclick = (event) => {
    [pool, value] = randomPoolNumber(pool, positions.length);
    const fen = positions[value];

    removeChessPieces();
    removeHelpers();
    svg_utils.removeAllSVG();
    chess = new Chess(fen);
    fenToChessboard(fen);
};