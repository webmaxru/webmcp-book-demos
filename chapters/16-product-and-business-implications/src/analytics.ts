// analytics.ts: DEMO FILLER, not a book listing. A stand-in for the site's analytics client.
// A real site would batch these and send them with navigator.sendBeacon().
export interface AnalyticsEvent { type: string; data: unknown; }
export const sent: AnalyticsEvent[] = [];
export const analytics = {
  send(type: string, data: unknown): void { sent.push({ type, data }); },
};
