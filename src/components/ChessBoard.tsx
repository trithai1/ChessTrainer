export function ChessBoard() {
  return (
    <div id="chess-container">
      <div id="chess-border">
        <div id="chess-grid">
          <div id="promotion-overlay">
            <div id="promotion-q">
              <div className="wq promotion-piece"></div>
            </div>
            <div id="promotion-n">
              <div className="wn promotion-piece"></div>
            </div>
            <div id="promotion-r">
              <div className="wr promotion-piece"></div>
            </div>
            <div id="promotion-b">
              <div className="wb promotion-piece"></div>
            </div>
          </div>
          <svg id="svg-container" viewBox="0 0 80 80"></svg>
        </div>
      </div>
    </div>
  );
}
