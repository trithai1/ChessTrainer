export const COORDS_ALPHA = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const GAME_STATUS = {
    INPROGRESS: 0,
    WHITE_WIN: 1,
    BLACK_WIN: 2,
    DRAW: 3,
};

export const CHECK_STATE = {
    WHITE_IN_CHECK: 0,
    BLACK_IN_CHECK: 1,
}

export const CHESS_PIECE = {
    PAWN  : "P",
    KNIGHT: "N",
    BISHOP: "B",
    ROOK  : "R",
    QUEEN : "Q",
    KING  : "K",  
};

export const FEN_PIECE = {
    WHITE_PAWN  : 'P',
    WHITE_KNIGHT: 'N',
    WHITE_BISHOP: 'B',
    WHITE_ROOK  : 'R',
    WHITE_QUEEN : 'Q',
    WHITE_KING  : 'K',
    BLACK_PAWN  : 'p',
    BLACK_KNIGHT: 'n',
    BLACK_BISHOP: 'b',
    BLACK_ROOK  : 'r',
    BLACK_QUEEN : 'q',
    BLACK_KING  : 'k',
};

export const FEN_PIECE_KEY = {
    P: 0,
    N: 1,
    B: 2,
    R: 3,
    Q: 4,
    K: 5,
    p: 6,
    n: 7,
    b: 8,
    r: 9,
    q: 10,
    k: 11,
}

export const CASTLING_KEY = {
    WHITE_KINGSIDE : 0,
    WHITE_QUEENSIDE: 1,
    BLACK_KINGSIDE : 2,
    BLACK_QUEENSIDE: 3,
}

export const FEN_PIECE_LIST = { // index corresponds to PIECE_COLOR
    PAWN  : [FEN_PIECE.BLACK_PAWN  , FEN_PIECE.WHITE_PAWN  ],
    KNIGHT: [FEN_PIECE.BLACK_KNIGHT, FEN_PIECE.WHITE_KNIGHT],
    BISHOP: [FEN_PIECE.BLACK_BISHOP, FEN_PIECE.WHITE_BISHOP],
    ROOK  : [FEN_PIECE.BLACK_ROOK  , FEN_PIECE.WHITE_ROOK  ],
    QUEEN : [FEN_PIECE.BLACK_QUEEN , FEN_PIECE.WHITE_QUEEN ],
    KING  : [FEN_PIECE.BLACK_KING  , FEN_PIECE.WHITE_KING  ]
};

export const FEN_PIECE_COLOR = {
    WHITE: [FEN_PIECE.WHITE_PAWN, FEN_PIECE.WHITE_KNIGHT, FEN_PIECE.WHITE_BISHOP, FEN_PIECE.WHITE_ROOK, FEN_PIECE.WHITE_QUEEN, FEN_PIECE.WHITE_KING],
    BLACK: [FEN_PIECE.BLACK_PAWN, FEN_PIECE.BLACK_KNIGHT, FEN_PIECE.BLACK_BISHOP, FEN_PIECE.BLACK_ROOK, FEN_PIECE.BLACK_QUEEN, FEN_PIECE.BLACK_KING]
};

export const PIECE_COLOR = {
    WHITE: true,
    BLACK: false
};

export const CSS_PIECE = {
    WHITE_PAWN  : "wp",
    WHITE_KNIGHT: "wn",
    WHITE_BISHOP: "wb",
    WHITE_ROOK  : "wr",
    WHITE_QUEEN : "wq",
    WHITE_KING  : "wk",
    BLACK_PAWN  : "bp",
    BLACK_KNIGHT: "bn",
    BLACK_BISHOP: "bb",
    BLACK_ROOK  : "br",
    BLACK_QUEEN : "bq",
    BLACK_KING  : "bk",
};

export const PIECE = {
    WHITE_PAWN:   {key: 0,  fen: FEN_PIECE.WHITE_PAWN,   css: CSS_PIECE.WHITE_PAWN,   color: PIECE_COLOR.WHITE, type: CHESS_PIECE.PAWN},
    WHITE_KNIGHT: {key: 1,  fen: FEN_PIECE.WHITE_KNIGHT, css: CSS_PIECE.WHITE_KNIGHT, color: PIECE_COLOR.WHITE, type: CHESS_PIECE.KNIGHT},
    WHITE_BISHOP: {key: 2,  fen: FEN_PIECE.WHITE_BISHOP, css: CSS_PIECE.WHITE_BISHOP, color: PIECE_COLOR.WHITE, type: CHESS_PIECE.BISHOP},
    WHITE_ROOK:   {key: 3,  fen: FEN_PIECE.WHITE_ROOK,   css: CSS_PIECE.WHITE_ROOK,   color: PIECE_COLOR.WHITE, type: CHESS_PIECE.ROOK},
    WHITE_QUEEN:  {key: 4,  fen: FEN_PIECE.WHITE_QUEEN,  css: CSS_PIECE.WHITE_QUEEN,  color: PIECE_COLOR.WHITE, type: CHESS_PIECE.QUEEN},
    WHITE_KING:   {key: 5,  fen: FEN_PIECE.WHITE_KING,   css: CSS_PIECE.WHITE_KING,   color: PIECE_COLOR.WHITE, type: CHESS_PIECE.KING},
    BLACK_PAWN:   {key: 6,  fen: FEN_PIECE.BLACK_PAWN,   css: CSS_PIECE.BLACK_PAWN,   color: PIECE_COLOR.BLACK, type: CHESS_PIECE.PAWN},
    BLACK_KNIGHT: {key: 7,  fen: FEN_PIECE.BLACK_KNIGHT, css: CSS_PIECE.BLACK_KNIGHT, color: PIECE_COLOR.BLACK, type: CHESS_PIECE.KNIGHT},
    BLACK_BISHOP: {key: 8,  fen: FEN_PIECE.BLACK_BISHOP, css: CSS_PIECE.BLACK_BISHOP, color: PIECE_COLOR.BLACK, type: CHESS_PIECE.BISHOP},
    BLACK_ROOK:   {key: 9,  fen: FEN_PIECE.BLACK_ROOK,   css: CSS_PIECE.BLACK_ROOK,   color: PIECE_COLOR.BLACK, type: CHESS_PIECE.ROOK},
    BLACK_QUEEN:  {key: 10, fen: FEN_PIECE.BLACK_QUEEN,  css: CSS_PIECE.BLACK_QUEEN,  color: PIECE_COLOR.BLACK, type: CHESS_PIECE.QUEEN},
    BLACK_KING:   {key: 11, fen: FEN_PIECE.BLACK_KING,   css: CSS_PIECE.BLACK_KING,   color: PIECE_COLOR.BLACK, type: CHESS_PIECE.KING},
}

export const PIECE_BY_FEN = Object.fromEntries(
    Object.values(PIECE).map(piece => [piece.fen, piece])
);

export const PIECE_BY_CSS = Object.fromEntries(
    Object.values(PIECE).map(piece => [piece.css, piece])
);
