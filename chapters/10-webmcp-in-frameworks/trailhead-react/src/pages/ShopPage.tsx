import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CATEGORIES, searchProducts, type Category } from '../catalog';
import { cartStore } from '../cart-store';

export function ShopPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [selected, setSelected] = useState<string[]>([]);
  const products = searchProducts({ query, category: category || undefined });

  const toggle = (sku: string) =>
    setSelected((s) => (s.includes(sku) ? s.filter((x) => x !== sku) : [...s, sku].slice(-4)));

  return (
    <section>
      <h1>Gear for the Norwegian outdoors</h1>
      <div className="filters">
        <input aria-label="Search products" placeholder="Search tents, boots, jackets…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" disabled={selected.length < 2}
          onClick={() => navigate(`/compare?skus=${selected.join(',')}`)}>
          Compare ({selected.length})
        </button>
      </div>
      <ul className="grid">
        {products.map((p) => (
          <li key={p.sku} className="card" data-sku={p.sku}>
            <h2>{p.name}</h2>
            <p className="meta">{p.category} · ★ {p.rating} · {p.inStock ? 'In stock' : 'Out of stock'}</p>
            <p className="price">{p.price.amount.toLocaleString('nb-NO')} NOK</p>
            <label><input type="checkbox" checked={selected.includes(p.sku)} onChange={() => toggle(p.sku)} /> Compare</label>
            <button type="button" disabled={!p.inStock} onClick={() => cartStore.add(p.sku, 1)}>Add to cart</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
