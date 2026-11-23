import { Outlet } from "react-router";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

export function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex flex-col flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}