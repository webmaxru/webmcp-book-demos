import { useSearchParams } from 'react-router';
import { compareProducts, getProduct, type Product } from '../catalog';

export function ComparePage() {
  const [params] = useSearchParams();
  const products = (params.get('skus') ?? '').split(',')
    .map((sku) => getProduct(sku))
    .filter((p): p is Product => p !== undefined);
  if (products.length < 2) return <p>Pick at least two products to compare.</p>;
  const { rows } = compareProducts(products);
  return (
    <section>
      <h1>Compare</h1>
      <table className="compare">
        <thead><tr><th></th>{products.map((p) => <th key={p.sku}>{p.name}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attribute}><th>{r.attribute}</th>{r.values.map((v, i) => <td key={i}>{String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
