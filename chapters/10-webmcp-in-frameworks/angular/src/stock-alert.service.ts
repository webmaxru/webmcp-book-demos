import { Service, signal } from '@angular/core';

export interface StockAlert { email: string; sku: string; quantity: number }

@Service()
export class StockAlertService {
  readonly saved = signal<StockAlert[]>([]);

  async subscribe(alert: StockAlert): Promise<void> {
    this.saved.update((all) => [...all, alert]);   // a real store would call its backend here
  }
}
