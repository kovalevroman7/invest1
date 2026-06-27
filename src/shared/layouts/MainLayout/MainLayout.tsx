import { NavLink, Outlet } from 'react-router';

export const MainLayout = () => (
  <div>
    <nav style={{ display: 'flex', gap: 16, padding: 16, borderBottom: '1px solid #ddd' }}>
      <NavLink to="/">Главная</NavLink>
      <NavLink to="/bonds">Облигации</NavLink>
      <NavLink to="/posts">Посты</NavLink>
      <NavLink to="/about">О проекте</NavLink>
    </nav>
    <main style={{ padding: 16 }}>
      <Outlet />
    </main>
  </div>
);
