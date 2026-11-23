import { ChessBoard } from "../components/ChessBoard";
import { SideBar } from "../components/SideBar";
import { initializeChallenge } from "../chess/manager.js";
import { useEffect } from "react";


export function Home() {
  useEffect(() => {
    console.log("test");
    initializeChallenge();
  }, []);

  return (
    <div className="game h-screen">
      <ChessBoard />
      <SideBar />
    </div>
  );
}