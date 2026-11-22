import { ChessBoard } from "../components/ChessBoard";
import { SideBar } from "../components/SideBar";


export function Home() {
  return (
    <div className="game">
      <ChessBoard />
      <SideBar />
    </div>
  );
}