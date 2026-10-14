// The agent-facing metadata of earlier versions of these tools, copied from
// Listing 6.2, Listing 6.7 and Listing 7.3 (execute callbacks omitted). Used by
// the tests to measure and lint "before" against this chapter's "after".
export const BEFORE = [
  {
    from: 'Listing 6.2', name: 'search_products',
    description: 'Search the Trailhead catalogue by keyword, with an optional category, ' +
      'maximum price in NOK and in-stock filter. Returns up to 10 products ' +
      'with SKU, name, price, rating and stock. Does not change the cart.',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: 'Keywords, e.g. "2 person tent"' },
      category: { type: 'string', enum: ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'] },
      maxPrice: { type: 'number', description: 'Highest price in NOK' },
      inStockOnly: { type: 'boolean', description: 'Only products in stock' } }, required: ['query'] },
  },
  {
    from: 'Listing 6.7', name: 'add_to_cart',
    description: 'Add 1 to 10 units of one product to the cart, by SKU. Adding a SKU that is ' +
      'already in the cart increases its quantity. Returns the cart line and total.',
    inputSchema: { type: 'object', properties: {
      sku: { type: 'string', description: 'Product SKU from search_products' },
      quantity: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['sku', 'quantity'] },
  },
  {
    from: 'Listing 7.3', name: 'search_articles',
    description: 'Search the Supportly help centre for articles that answer a ' +
      'question about the product. Returns titles, links and a short excerpt.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 200 } }, required: ['query'] },
  },
  {
    from: 'Listing 7.3', name: 'create_ticket',
    description: 'Open a support ticket with the Supportly team on the user\'s behalf. ' +
      'The user reviews and sends it in the help widget. Returns the ticket ID.',
    inputSchema: { type: 'object', properties: {
      subject: { type: 'string', maxLength: 120 },
      body: { type: 'string', maxLength: 4000 },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] } }, required: ['subject', 'body', 'priority'] },
  },
  {
    from: 'Listing 7.3', name: 'get_ticket_status',
    description: 'Get the status and latest reply of a Supportly ticket by its ID ' +
      '(for example SUP-1042).',
    inputSchema: { type: 'object', properties: { ticketId: { type: 'string', pattern: '^SUP-[0-9]+$' } }, required: ['ticketId'] },
  },
];
