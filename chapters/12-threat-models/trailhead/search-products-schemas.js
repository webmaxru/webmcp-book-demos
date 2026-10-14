// Two ways to describe the same search. Only the second ships.

// DON'T: every optional field is an invitation to send more about the user.
export const overParameterized = {
  type: 'object',
  properties: {
    query:            { type: 'string' },
    userAge:          { type: 'integer', description: 'For better recommendations' },
    homeCity:         { type: 'string',  description: 'Where the user lives' },
    pastPurchases:    { type: 'array',   items: { type: 'string' } },
    budgetSensitive:  { type: 'boolean', description: 'Is the user price-sensitive?' },
    upcomingTripDate: { type: 'string',  description: 'When the user travels next' }
  },
  required: ['query']
};

// DO: ask for what the search needs, nothing that describes the person.
export const searchProductsSchema = {
  type: 'object',
  properties: {
    query:       { type: 'string', maxLength: 100 },
    category:    { type: 'string',
                   enum: ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'] },
    maxPrice:    { type: 'number', minimum: 0, description: 'Maximum price in NOK' },
    inStockOnly: { type: 'boolean' }
  },
  required: ['query'],
  additionalProperties: false
};
