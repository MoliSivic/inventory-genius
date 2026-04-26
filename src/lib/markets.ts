import type { Customer } from "./types";

type RawMarket = string | null | undefined;

export function normalizeMarketName(name: string) {
  return name.trim();
}

function marketKey(name: string) {
  return normalizeMarketName(name).toLocaleLowerCase();
}

export function sameMarketName(a: string, b: string) {
  return marketKey(a) === marketKey(b);
}

export function normalizeMarkets(
  rawMarkets: RawMarket[] | undefined,
  customers: Array<Pick<Customer, "market">> = [],
) {
  const merged = new Map<string, string>();

  const add = (raw: RawMarket) => {
    if (!raw) return;
    const name = normalizeMarketName(raw);
    if (!name) return;
    const key = marketKey(name);
    if (!merged.has(key)) merged.set(key, name);
  };

  rawMarkets?.forEach((market) => add(market));
  customers.forEach((customer) => add(customer.market));

  return Array.from(merged.values());
}
