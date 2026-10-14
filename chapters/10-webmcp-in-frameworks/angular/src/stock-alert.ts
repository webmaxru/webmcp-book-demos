import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, min, required } from '@angular/forms/signals';
import { StockAlertService } from './stock-alert.service';

@Component({
  selector: 'th-stock-alert',
  imports: [FormField],
  template: `
    <h1>Tell me when it's back</h1>
    <label>Email <input type="email" [formField]="alertForm.email" /></label>
    <label>SKU <input [formField]="alertForm.sku" /></label>
    <label>Quantity <input type="number" [formField]="alertForm.quantity" /></label>
  `,
})
export class StockAlertPage {
  private readonly alerts = inject(StockAlertService);
  private readonly model = signal({ email: '', sku: '', quantity: 1 });   // concrete initial values

  readonly alertForm = form(
    this.model,
    (f) => {
      required(f.email, { message: 'An email address is required.' });
      email(f.email, { message: 'Enter a valid email address.' });
      required(f.sku, { message: 'Give the product SKU from search_products.' });
      min(f.quantity, 1, { message: 'Quantity must be at least 1.' });
    },
    {
      experimentalWebMcpTool: {
        name: 'request_stock_alert',
        description: 'Ask Trailhead to email the user when an out-of-stock product is back in stock.',
      },
      submission: {
        action: async (field) => {
          await this.alerts.subscribe(field().value());
          return undefined;
        },
      },
    },
  );
}
