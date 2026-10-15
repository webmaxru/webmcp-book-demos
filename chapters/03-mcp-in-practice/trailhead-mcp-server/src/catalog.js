// A stand-in for Trailhead's real product and order services.
export const products = [
  { sku: 'TH-TENT-001', name: 'Fjellheim 2 Tent', category: 'tents',
    tags: ['2-person', 'tent', 'backpacking'], price: 3499, rating: 4.6, inStock: true },
  { sku: 'TH-TENT-002', name: 'Lofoten 4 Dome Tent', category: 'tents',
    tags: ['4-person', 'tent', 'family'], price: 5999, rating: 4.3, inStock: false },
  { sku: 'TH-BAG-001', name: 'Polar Down Sleeping Bag -15', category: 'sleeping-bags',
    tags: ['down', 'winter', 'sleeping bag'], price: 4299, rating: 4.8, inStock: true },
  { sku: 'TH-PACK-001', name: 'Besseggen 45 L Backpack', category: 'backpacks',
    tags: ['45l', 'hiking', 'backpack'], price: 1899, rating: 4.5, inStock: true },
  { sku: 'TH-BOOT-001', name: 'Rondane GTX Hiking Boot', category: 'footwear',
    tags: ['waterproof', 'hiking', 'boot'], price: 2499, rating: 4.4, inStock: true },
  { sku: 'TH-SHELL-001', name: 'Vestland Rain Shell', category: 'clothing',
    tags: ['waterproof', 'jacket', 'rain'], price: 2799, rating: 4.7, inStock: false }
];

export const orders = new Map([
  ['TH-100231', { orderState: 'shipped', carrier: 'Posten', estimatedDelivery: '2026-10-17' }],
  ['TH-100232', { orderState: 'processing', carrier: null, estimatedDelivery: '2026-10-21' }]
]);
