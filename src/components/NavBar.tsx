import { NavLink } from "react-router";


export function NavBar() {
  return (
    <nav className="nav-header">
      <div className="header-left">
        <NavLink to="/">Board</NavLink> |
        <NavLink to="/about">About</NavLink>
      </div>
    </nav>
  );
}
