// The Fume data contract: the seam between the screens and everything behind them. Import from here.
//
//   entities/<domain>.ts  what the backend stores and the front end shows
//   views/<domain>.ts     view models: shapes built for one screen, so a screen makes one call
//   api/<domain>.ts       the calls, one interface per domain, and the inputs they take; api/index.ts joins them
//                         into FumeApi
//   events.ts             what changes while a screen is open (FumeEvent, subscribe)
//   errors.ts             what a call fails with (FumeError)
//
// Domains: identity, home, brand, products, campaigns, plan, production, studio, quality, review, delivery,
// conversation, agency, notifications; entities/common.ts holds what they share (ids, times, provenance).

export * from "./entities";
export * from "./views";
export * from "./api";
export * from "./events";
export * from "./errors";
