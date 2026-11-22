export function SideBar() {
  return (
    <div id="side-panel">
      <div className="rating-container">
        <p>Ratings</p>
        <div className="ratings">
          <div className="puzzle rating">
            <span className="label">Puzzle</span>
            <span className="value">1000</span>
          </div>
          <div className="position rating">
            <span className="label">Position</span>
            <span className="value">1000</span>
          </div>
        </div>
      </div>
      <div className="move-classification">
        <p>...</p>
      </div>
      <button className="next-challenge" disabled>Inprogress...</button>
    </div>
  );
}
