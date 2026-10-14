import '@angular/compiler';   // JIT: this test build compiles templates in the browser
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { CartService } from './cart.service';
import { StockAlertService } from './stock-alert.service';
import { AppRoot } from './pages';

bootstrapApplication(AppRoot, appConfig).then((app) => {
  // Test hooks only: let the Playwright test seed and read state.
  Object.assign(window, {
    __cart: app.injector.get(CartService),
    __alerts: app.injector.get(StockAlertService),
  });
});
