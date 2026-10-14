import * as z from 'zod/v4';
import { products, orders } from './catalog.js';

const Product = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.object({ amount: z.number(), currency: z.literal('NOK') }),
  rating: z.number(),
  inStock: z.boolean()
});

export function registerTools(server) {
  server.registerTool(
    'search_products',
    {
      title: 'Search Trailhead products',
      description:
        'Search the Trailhead outdoor-gear catalogue by keywords, optionally ' +
        'filtered by category, maximum price in NOK and stock. ' +
        'Returns at most 10 products. Does not change anything.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Keywords, e.g. "2-person tent"'),
        category: z
          .enum(['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'])
          .optional(),
        maxPrice: z.number().positive().optional().describe('Maximum price in NOK'),
        inStockOnly: z.boolean().optional()
      }),
      outputSchema: z.object({ products: z.array(Product) }),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ query, category, maxPrice, inStockOnly }) => {
      const words = query.toLowerCase().split(/\s+/);
      const found = products
        .filter((p) => {
          const text = [p.name, p.category, ...p.tags].join(' ').toLowerCase();
          return words.every((word) => text.includes(word));
        })
        .filter((p) => !category || p.category === category)
        .filter((p) => maxPrice === undefined || p.price <= maxPrice)
        .filter((p) => !inStockOnly || p.inStock)
        .slice(0, 10)
        .map(({ sku, name, price, rating, inStock }) => ({
          sku, name, price: { amount: price, currency: 'NOK' }, rating, inStock
        }));

      const output = { products: found };
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    'get_order_status',
    {
      title: 'Get order status',
      description:
        'Look up the delivery status of a Trailhead order by its order ID ' +
        '(format TH-123456). Does not change anything.',
      inputSchema: z.object({
        orderId: z.string().regex(/^TH-\d{6}$/).describe('Order ID, e.g. TH-100231')
      }),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ orderId }) => {
      const order = orders.get(orderId);
      if (!order) {
        // A recoverable failure: tell the model what went wrong, as a result.
        return {
          content: [{ type: 'text', text: `No order found with ID ${orderId}.` }],
          isError: true
        };
      }
      const output = { orderId, ...order };
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  );
}
