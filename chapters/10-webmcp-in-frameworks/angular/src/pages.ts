import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './cart.service';

@Component({ selector: 'th-shop', template: `<h1>Shop</h1>` })
export class ShopPage {}

@Component({ selector: 'th-cart', template: `<h1>Cart</h1><p>Total: {{ cart.total() }} NOK</p>` })
export class CartPage {
  readonly cart = inject(CartService);
}

@Component({
  selector: 'th-root',
  imports: [RouterOutlet, RouterLink],
  template: `<nav><a routerLink="/">Shop</a> <a routerLink="/cart">Cart</a> <a routerLink="/stock-alert">Stock alert</a></nav><router-outlet />`,
})
export class AppRoot {}
