import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router';
import { AgentActivity } from './agent/AgentActivity';
import { AgentTools } from './agent/AgentTools';
import { useCart } from './cart-store';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CartPage } from './pages/CartPage';
import { ComparePage } from './pages/ComparePage';
import { ShopPage } from './pages/ShopPage';

function Layout() {
  const cart = useCart();
  return (
    <>
      <header>
        <Link to="/" className="brand">Trailhead</Link>
        <nav>
          <Link to="/">Shop</Link>
          <Link to="/cart" data-testid="cart-link">Cart ({cart.itemCount})</Link>
        </nav>
      </header>
      <AgentTools />
      <AgentActivity />
      <ConfirmDialog />
      <main><Outlet /></main>
      <footer>{'modelContext' in document ? 'WebMCP tools available' : 'WebMCP not available in this browser'}</footer>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ShopPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="cart" element={<CartPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
