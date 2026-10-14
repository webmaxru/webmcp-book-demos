import { inject, provideExperimentalWebMcpTools } from '@angular/core';
import type { Routes } from '@angular/router';
import { CartService } from './cart.service';
import { CartPage, ShopPage } from './pages';
import { StockAlertPage } from './stock-alert';

export const routes: Routes = [
  { path: '', component: ShopPage },
  {
    path: 'cart',
    component: CartPage,
    providers: [
      provideExperimentalWebMcpTools([   // registered while /cart is active
        {
          name: 'get_cart',
          description: 'Read the current shopping cart: lines and total in NOK.',
          inputSchema: { type: 'object', properties: {} },
          annotations: { readOnlyHint: true },
          execute: () => inject(CartService).snapshot(),
        },
      ]),
    ],
  },
  { path: 'stock-alert', component: StockAlertPage },
];
