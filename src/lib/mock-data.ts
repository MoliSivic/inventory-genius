import type { AppState, ProductCostLayer } from "./types";
import { DEFAULT_CATEGORIES, normalizeCategories } from "./categories";
import { normalizeMarkets } from "./markets";

const THANG_KHMAO_DOM_KHLOK_SIZES = ["5 x 9", "6 x 11", "6 x 14", "8 x 15", "9 x 18", "12 x 20"] as const;
const THANG_PORN_LOR_SIZES = [
  "6 x 11",
  "6 x 14",
  "8 x 15",
  "9 x 18",
  "12 x 20",
  "14 x 24",
  "16 x 28",
] as const;

function sizeKey(size: string) {
  return size.replace(/\s+/g, "").toLocaleLowerCase();
}

function roundMoney(value: number) {
  return Number(value.toFixed(4));
}

function khmaoDomId(size: string) {
  return `preset_thang_khmao_dom_${sizeKey(size)}`;
}

function pornLorId(size: string) {
  return `preset_thang_porn_lor_${sizeKey(size)}`;
}

const seedFactories: AppState["factories"] = [
  {
    id: "f1",
    name: "Sunrise Plastic Factory",
    phone: "+855 12 345 678",
    location: "Phnom Penh",
    notes: "Reliable, ships weekly",
  },
  { id: "f2", name: "GreenLeaf Industries", phone: "+855 17 222 333", location: "Siem Reap" },
  {
    id: "f3",
    name: "Mekong Plastics Co.",
    phone: "+855 92 888 111",
    location: "Battambang",
    notes: "Best for sacks",
  },
];

const STOCK_IN_PLAN: Array<{
  id: string;
  invoiceNumber: string;
  factoryId: string;
  date: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number; buyPrice: number }>;
}> = [
  {
    id: "si_2026_02_10",
    invoiceNumber: "INV-1001",
    factoryId: "f1",
    date: "2026-02-10",
    notes: "Initial ខ្មៅដុំ stock-up",
    items: [
      { productId: khmaoDomId("5 x 9"), quantity: 60, buyPrice: 7.5 },
      { productId: khmaoDomId("6 x 11"), quantity: 50, buyPrice: 8.5 },
      { productId: khmaoDomId("6 x 14"), quantity: 40, buyPrice: 9.5 },
    ],
  },
  {
    id: "si_2026_03_05",
    invoiceNumber: "INV-1002",
    factoryId: "f2",
    date: "2026-03-05",
    items: [
      { productId: khmaoDomId("8 x 15"), quantity: 40, buyPrice: 11 },
      { productId: khmaoDomId("9 x 18"), quantity: 30, buyPrice: 13.5 },
      { productId: khmaoDomId("12 x 20"), quantity: 25, buyPrice: 17 },
    ],
  },
  {
    id: "si_2026_03_22",
    invoiceNumber: "INV-1003",
    factoryId: "f3",
    date: "2026-03-22",
    notes: "Mid-month ល្អ resupply",
    items: [
      { productId: pornLorId("6 x 11"), quantity: 80, buyPrice: 6.5 },
      { productId: pornLorId("6 x 14"), quantity: 60, buyPrice: 7.5 },
      { productId: pornLorId("8 x 15"), quantity: 50, buyPrice: 9 },
      { productId: pornLorId("9 x 18"), quantity: 40, buyPrice: 11 },
    ],
  },
  {
    id: "si_2026_04_12",
    invoiceNumber: "INV-1004",
    factoryId: "f1",
    date: "2026-04-12",
    items: [
      { productId: pornLorId("12 x 20"), quantity: 35, buyPrice: 14 },
      { productId: pornLorId("14 x 24"), quantity: 25, buyPrice: 17.5 },
      { productId: pornLorId("16 x 28"), quantity: 20, buyPrice: 21 },
    ],
  },
  {
    id: "si_2026_04_20",
    invoiceNumber: "INV-1005",
    factoryId: "f2",
    date: "2026-04-20",
    notes: "Top-up before weekend",
    items: [
      { productId: khmaoDomId("5 x 9"), quantity: 30, buyPrice: 7.8 },
      { productId: khmaoDomId("6 x 11"), quantity: 25, buyPrice: 8.8 },
      { productId: pornLorId("6 x 11"), quantity: 40, buyPrice: 6.8 },
      { productId: pornLorId("8 x 15"), quantity: 30, buyPrice: 9.2 },
    ],
  },
];

const productLayersById = (() => {
  const map = new Map<string, ProductCostLayer[]>();
  for (const invoice of STOCK_IN_PLAN) {
    for (const item of invoice.items) {
      const layers = map.get(item.productId) ?? [];
      layers.push({ quantity: item.quantity, unitCost: item.buyPrice });
      map.set(item.productId, layers);
    }
  }
  return map;
})();

function buildSeedProductTotals(productId: string) {
  const layers = productLayersById.get(productId) ?? [];
  const stock = layers.reduce((sum, layer) => sum + layer.quantity, 0);
  const totalCostBasis = roundMoney(
    layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0),
  );
  const avgCost = stock > 0 ? roundMoney(totalCostBasis / stock) : 0;
  return { stock, totalCostBasis, avgCost, costLayers: layers };
}

const seedProducts: AppState["products"] = [
  ...THANG_KHMAO_DOM_KHLOK_SIZES.map((size) => {
    const id = khmaoDomId(size);
    const totals = buildSeedProductTotals(id);
    return {
      id,
      name: `ថង់ខ្មៅដុំ ${size} ឃ្លោក`,
      category: "ថង់ខ្មៅដុំ",
      unit: ["បេ"] as AppState["products"][number]["unit"],
      ...totals,
      saleSubUnits: [{ unit: "កញ្ចប់" as const, quantityPerStockUnit: 50 }],
      minStock: 10,
      variants: [],
    };
  }),
  ...THANG_PORN_LOR_SIZES.map((size) => {
    const id = pornLorId(size);
    const totals = buildSeedProductTotals(id);
    return {
      id,
      name: `ថង់ពណ៌ ${size} ល្អ`,
      category: "ថង់ពណ៌",
      unit: ["បេ"] as AppState["products"][number]["unit"],
      ...totals,
      minStock: 10,
      variants: [],
    };
  }),
];

const seedCustomers: AppState["customers"] = [
  {
    id: "c1",
    name: "Sok Dara",
    phone: "+855 11 111 222",
    market: "Central Market",
    type: "Retailer",
  },
  {
    id: "c2",
    name: "Chan Pisey",
    phone: "+855 12 333 444",
    market: "Orussey Market",
    type: "Wholesaler",
    notes: "Bulk buyer",
  },
  {
    id: "c3",
    name: "Mey Lin",
    phone: "+855 16 555 666",
    market: "Toul Tom Poung",
    type: "Retailer",
  },
  {
    id: "c4",
    name: "Hok Sokha",
    phone: "+855 70 777 888",
    market: "Central Market",
    type: "Wholesaler",
  },
  {
    id: "c5",
    name: "Vanna Shop",
    phone: "+855 88 999 000",
    market: "Orussey Market",
    type: "Retailer",
  },
];

export const LEGACY_SAMPLE_PRODUCT_IDS = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
  "p9",
  "p10",
] as const;

const seedStockIns: AppState["stockIns"] = STOCK_IN_PLAN.map((invoice) => ({
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  factoryId: invoice.factoryId,
  date: invoice.date,
  notes: invoice.notes,
  items: invoice.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    buyPrice: item.buyPrice,
  })),
  total: roundMoney(
    invoice.items.reduce((sum, item) => sum + item.quantity * item.buyPrice, 0),
  ),
}));

export const seedData: AppState = {
  shopName: "Family Plastic Co.",
  categories: normalizeCategories(DEFAULT_CATEGORIES, seedProducts, { includeDefaults: true }),
  markets: normalizeMarkets(undefined, seedCustomers),
  products: seedProducts,
  factories: seedFactories,
  customers: seedCustomers,
  stockIns: seedStockIns,
  sales: [],
  customerPrices: [],
  payments: [],
};
