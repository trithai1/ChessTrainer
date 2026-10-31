import {FEN_PIECE, CSS_PIECE} from "./chess_constants.js";

export const isUpper = (char) => char.charCodeAt(0) >= 65 && char.charCodeAt(0) <= 90;
export const isLower = (char) => char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122;
export const isDigit = (char) => char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57;

const INVERTED_FEN_PIECE = {};
for (const key in FEN_PIECE) {
  INVERTED_FEN_PIECE[FEN_PIECE[key]] = key;
}
export function fenToCssPiece(fenPiece) { return CSS_PIECE[INVERTED_FEN_PIECE[fenPiece]] ?? undefined; }