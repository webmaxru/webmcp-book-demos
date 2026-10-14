// Demo-only declarations for Fjord Table's own objects, so Listing 5.6 type-checks on its own.
// They describe the shapes in ../availability.js and ../booking-panel.js.

interface Slot {
  date: string;
  time: string;                 // 24h HH:MM
  partySize: number;
  seating: Array<'window' | 'indoor' | 'terrace'>;
}

declare const availability: {
  search(query: { date: string; time?: string; partySize: number; signal?: AbortSignal }): Promise<Slot[]>;
};

declare const bookingPanel: {
  showSlots(slots: Slot[]): void;
};
