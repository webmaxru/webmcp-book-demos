import { useNavigate } from 'react-router';
import { useWebMCP } from 'usewebmcp';
import { addToCartSchema, addToCartTool, getCartTool } from './cart-tools';
import { compareProductsSchema, compareProductsTool } from './compare-products';
import { searchProductsSchema, searchProductsTool } from './search-products';

// App-wide tools. Mounted once in the layout, so they live as long as the app.
export function AgentTools() {
  const navigate = useNavigate();

  useWebMCP({
    name: 'search_products',
    description: 'Search the Trailhead catalog of outdoor gear. Returns matching products with SKU, name, price in NOK, rating and stock status.',
    inputSchema: searchProductsSchema,
    annotations: { readOnlyHint: true },
    execute: searchProductsTool,
  });

  useWebMCP({
    name: 'compare_products',
    description: 'Compare 2 to 4 products side by side by price, rating, weight and stock. Also shows the comparison to the user.',
    inputSchema: compareProductsSchema,
    annotations: { readOnlyHint: true },
    execute: (input) => {
      const result = compareProductsTool(input);
      if (!('error' in result)) navigate(`/compare?skus=${input.skus.join(',')}`);
      return result;
    },
  });

  useWebMCP({
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart by SKU. Returns the updated item count and total.',
    inputSchema: addToCartSchema,
    execute: addToCartTool,
  });

  useWebMCP({
    name: 'get_cart',
    description: 'Read the current shopping cart: lines, item count and total in NOK.',
    annotations: { readOnlyHint: true },
    execute: getCartTool,
  });

  return null;
}
