import { type ApplicationConfig, inject, provideExperimentalWebMcpTools } from '@angular/core';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import { provideRouter, withAutoCleanupInjectors } from '@angular/router';
import { CatalogService } from './catalog.service';
import { CATEGORIES } from './catalog';
import { routes } from './routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withAutoCleanupInjectors()),   // route tools go away with their route
    provideExperimentalWebMcpForms(),                     // lets Signal Forms opt in as tools
    provideExperimentalWebMcpTools([                      // app-wide: registered for the app's lifetime
      {
        name: 'search_products',
        description: 'Search the Trailhead catalog of outdoor gear. Returns matching products with SKU, name, price in NOK, rating and stock status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keywords, for example "down sleeping bag".' },
            category: { type: 'string', enum: [...CATEGORIES] },
            maxPrice: { type: 'number', description: 'Optional maximum price in NOK.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: ({ query, category, maxPrice }) => {
          if (typeof query !== 'string') return { error: 'query must be a string.' };
          if (category !== undefined && !CATEGORIES.includes(category)) {
            return { error: `category must be one of: ${CATEGORIES.join(', ')}.` };
          }
          return { products: inject(CatalogService).search({ query, category, maxPrice }) };
        },
      },
    ]),
  ],
};
