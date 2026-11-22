import { Outlet } from "react-router";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

export function AppLayout() {
  return (
    <>
      <NavBar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}