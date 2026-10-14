import { Service } from '@angular/core';
import { searchProducts, type ProductQuery } from './catalog';

@Service()
export class CatalogService {
  search(query: ProductQuery) {
    return searchProducts(query).map(({ sku, name, price, rating, inStock }) => ({ sku, name, price, rating, inStock }));
  }
}
