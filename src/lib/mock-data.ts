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
  {
    id: "c6",
    name: "Kimly Store",
    phone: "+855 10 212 343",
    market: "Chbar Ampov Market",
    type: "Retailer",
    notes: "Usually buys every week",
  },
  {
    id: "c7",
    name: "Pich Wholesale",
    phone: "+855 77 456 789",
    market: "Daeum Kor Market",
    type: "Wholesaler",
  },
  {
    id: "c8",
    name: "Ravy Mart",
    phone: "+855 93 670 125",
    market: "Boeung Trabek Market",
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

/* ── Seed Sales ──────────────────────────────────────────────── */

function saleId(n: number) {
  return `seed_sale_${n}`;
}

const seedSales: AppState["sales"] = [
  // ── Sale 1 — Sok Dara — PAID ──
  {
    id: saleId(1),
    receiptNumber: "R-2001",
    customerId: "c1",
    date: "2026-03-01",
    items: [
      { productId: khmaoDomId("5 x 9"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 9.5, avgCostAtSale: 7.5 },
      { productId: khmaoDomId("6 x 11"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 10.5, avgCostAtSale: 8.5 },
    ],
    total: 79,
    estimatedProfit: 16,
    paidAmount: 79,
    paymentStatus: "paid",
    telegramStatus: "not_sent",
  },
  // ── Sale 2 — Chan Pisey — PAID ──
  {
    id: saleId(2),
    receiptNumber: "R-2002",
    customerId: "c2",
    date: "2026-03-03",
    items: [
      { productId: khmaoDomId("8 x 15"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 14, avgCostAtSale: 11 },
      { productId: khmaoDomId("9 x 18"), quantity: 2, unit: "បេ", stockQuantity: 2, unitPrice: 16.5, avgCostAtSale: 13.5 },
    ],
    total: 89,
    estimatedProfit: 18,
    paidAmount: 89,
    paymentStatus: "paid",
    telegramStatus: "customer",
  },
  // ── Sale 3 — Mey Lin — UNPAID ──
  {
    id: saleId(3),
    receiptNumber: "R-2003",
    customerId: "c3",
    date: "2026-03-05",
    items: [
      { productId: pornLorId("6 x 11"), quantity: 10, unit: "បេ", stockQuantity: 10, unitPrice: 8.5, avgCostAtSale: 6.5 },
    ],
    total: 85,
    estimatedProfit: 20,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 4 — Hok Sokha — PARTIAL ──
  {
    id: saleId(4),
    receiptNumber: "R-2004",
    customerId: "c4",
    date: "2026-03-07",
    items: [
      { productId: pornLorId("6 x 14"), quantity: 8, unit: "បេ", stockQuantity: 8, unitPrice: 9.5, avgCostAtSale: 7.5 },
      { productId: pornLorId("8 x 15"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 11.5, avgCostAtSale: 9 },
    ],
    total: 133.5,
    estimatedProfit: 28.5,
    paidAmount: 80,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 5 — Vanna Shop — PAID ──
  {
    id: saleId(5),
    receiptNumber: "R-2005",
    customerId: "c5",
    date: "2026-03-10",
    items: [
      { productId: khmaoDomId("12 x 20"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 21, avgCostAtSale: 17 },
    ],
    total: 63,
    estimatedProfit: 12,
    paidAmount: 63,
    paymentStatus: "paid",
    telegramStatus: "both",
  },
  // ── Sale 6 — Sok Dara — PARTIAL ──
  {
    id: saleId(6),
    receiptNumber: "R-2006",
    customerId: "c1",
    date: "2026-03-12",
    items: [
      { productId: khmaoDomId("6 x 14"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 12, avgCostAtSale: 9.5 },
      { productId: pornLorId("9 x 18"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 13.5, avgCostAtSale: 11 },
    ],
    total: 88.5,
    estimatedProfit: 17.5,
    paidAmount: 50,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 7 — Chan Pisey — UNPAID ──
  {
    id: saleId(7),
    receiptNumber: "R-2007",
    customerId: "c2",
    date: "2026-03-14",
    items: [
      { productId: pornLorId("12 x 20"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 17.5, avgCostAtSale: 14 },
    ],
    total: 87.5,
    estimatedProfit: 17.5,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 8 — Mey Lin — PAID ──
  {
    id: saleId(8),
    receiptNumber: "R-2008",
    customerId: "c3",
    date: "2026-03-16",
    items: [
      { productId: khmaoDomId("5 x 9"), quantity: 8, unit: "បេ", stockQuantity: 8, unitPrice: 9.5, avgCostAtSale: 7.5 },
    ],
    total: 76,
    estimatedProfit: 16,
    paidAmount: 76,
    paymentStatus: "paid",
    telegramStatus: "owner",
  },
  // ── Sale 9 — Hok Sokha — PAID ──
  {
    id: saleId(9),
    receiptNumber: "R-2009",
    customerId: "c4",
    date: "2026-03-18",
    items: [
      { productId: khmaoDomId("6 x 11"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 10.5, avgCostAtSale: 8.5 },
      { productId: khmaoDomId("6 x 14"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 12, avgCostAtSale: 9.5 },
    ],
    total: 99,
    estimatedProfit: 19.5,
    paidAmount: 99,
    paymentStatus: "paid",
    telegramStatus: "customer",
  },
  // ── Sale 10 — Vanna Shop — UNPAID ──
  {
    id: saleId(10),
    receiptNumber: "R-2010",
    customerId: "c5",
    date: "2026-03-20",
    items: [
      { productId: pornLorId("14 x 24"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 22, avgCostAtSale: 17.5 },
    ],
    total: 66,
    estimatedProfit: 13.5,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 11 — Sok Dara — PAID ──
  {
    id: saleId(11),
    receiptNumber: "R-2011",
    customerId: "c1",
    date: "2026-03-25",
    items: [
      { productId: pornLorId("6 x 11"), quantity: 12, unit: "បេ", stockQuantity: 12, unitPrice: 8.5, avgCostAtSale: 6.5 },
    ],
    total: 102,
    estimatedProfit: 24,
    paidAmount: 102,
    paymentStatus: "paid",
    telegramStatus: "both",
  },
  // ── Sale 12 — Chan Pisey — PARTIAL ──
  {
    id: saleId(12),
    receiptNumber: "R-2012",
    customerId: "c2",
    date: "2026-03-28",
    items: [
      { productId: khmaoDomId("9 x 18"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 16.5, avgCostAtSale: 13.5 },
      { productId: pornLorId("16 x 28"), quantity: 2, unit: "បេ", stockQuantity: 2, unitPrice: 26, avgCostAtSale: 21 },
    ],
    total: 101.5,
    estimatedProfit: 19,
    paidAmount: 60,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 13 — Mey Lin — PAID ──
  {
    id: saleId(13),
    receiptNumber: "R-2013",
    customerId: "c3",
    date: "2026-04-01",
    items: [
      { productId: pornLorId("8 x 15"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 11.5, avgCostAtSale: 9 },
    ],
    total: 69,
    estimatedProfit: 15,
    paidAmount: 69,
    paymentStatus: "paid",
    telegramStatus: "customer",
  },
  // ── Sale 14 — Hok Sokha — UNPAID ──
  {
    id: saleId(14),
    receiptNumber: "R-2014",
    customerId: "c4",
    date: "2026-04-03",
    items: [
      { productId: khmaoDomId("8 x 15"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 14, avgCostAtSale: 11 },
      { productId: khmaoDomId("5 x 9"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 9.5, avgCostAtSale: 7.5 },
    ],
    total: 127,
    estimatedProfit: 27,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 15 — Vanna Shop — PARTIAL ──
  {
    id: saleId(15),
    receiptNumber: "R-2015",
    customerId: "c5",
    date: "2026-04-05",
    items: [
      { productId: pornLorId("6 x 14"), quantity: 7, unit: "បេ", stockQuantity: 7, unitPrice: 9.5, avgCostAtSale: 7.5 },
    ],
    total: 66.5,
    estimatedProfit: 14,
    paidAmount: 30,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 16 — Sok Dara — PAID ──
  {
    id: saleId(16),
    receiptNumber: "R-2016",
    customerId: "c1",
    date: "2026-04-10",
    items: [
      { productId: khmaoDomId("6 x 11"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 10.5, avgCostAtSale: 8.5 },
      { productId: pornLorId("9 x 18"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 13.5, avgCostAtSale: 11 },
    ],
    total: 109.5,
    estimatedProfit: 20.5,
    paidAmount: 109.5,
    paymentStatus: "paid",
    telegramStatus: "customer",
  },
  // ── Sale 17 — Chan Pisey — PAID ──
  {
    id: saleId(17),
    receiptNumber: "R-2017",
    customerId: "c2",
    date: "2026-04-14",
    items: [
      { productId: pornLorId("6 x 11"), quantity: 15, unit: "បេ", stockQuantity: 15, unitPrice: 8.5, avgCostAtSale: 6.5 },
    ],
    total: 127.5,
    estimatedProfit: 30,
    paidAmount: 127.5,
    paymentStatus: "paid",
    telegramStatus: "both",
  },
  // ── Sale 18 — Mey Lin — PARTIAL ──
  {
    id: saleId(18),
    receiptNumber: "R-2018",
    customerId: "c3",
    date: "2026-04-18",
    items: [
      { productId: khmaoDomId("12 x 20"), quantity: 2, unit: "បេ", stockQuantity: 2, unitPrice: 21, avgCostAtSale: 17 },
      { productId: pornLorId("14 x 24"), quantity: 2, unit: "បេ", stockQuantity: 2, unitPrice: 22, avgCostAtSale: 17.5 },
    ],
    total: 86,
    estimatedProfit: 17,
    paidAmount: 40,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 19 — Hok Sokha — PAID ──
  {
    id: saleId(19),
    receiptNumber: "R-2019",
    customerId: "c4",
    date: "2026-04-22",
    items: [
      { productId: pornLorId("16 x 28"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 26, avgCostAtSale: 21 },
    ],
    total: 78,
    estimatedProfit: 15,
    paidAmount: 78,
    paymentStatus: "paid",
    telegramStatus: "owner",
  },
  // ── Sale 20 — Vanna Shop — UNPAID ──
  {
    id: saleId(20),
    receiptNumber: "R-2020",
    customerId: "c5",
    date: "2026-04-25",
    items: [
      { productId: khmaoDomId("6 x 14"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 12, avgCostAtSale: 9.5 },
      { productId: pornLorId("8 x 15"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 11.5, avgCostAtSale: 9 },
    ],
    total: 106,
    estimatedProfit: 22.5,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 21 — Kimly Store — PAID ──
  {
    id: saleId(21),
    receiptNumber: "R-2021",
    customerId: "c6",
    date: "2026-04-26",
    items: [
      { productId: khmaoDomId("5 x 9"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 9.75, avgCostAtSale: 7.5 },
      { productId: pornLorId("6 x 11"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 8.75, avgCostAtSale: 6.5 },
    ],
    total: 102.25,
    estimatedProfit: 24.75,
    paidAmount: 102.25,
    paymentStatus: "paid",
    telegramStatus: "not_sent",
  },
  // ── Sale 22 — Pich Wholesale — UNPAID ──
  {
    id: saleId(22),
    receiptNumber: "R-2022",
    customerId: "c7",
    date: "2026-04-27",
    items: [
      { productId: khmaoDomId("8 x 15"), quantity: 7, unit: "បេ", stockQuantity: 7, unitPrice: 14.25, avgCostAtSale: 11 },
      { productId: pornLorId("8 x 15"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 11.75, avgCostAtSale: 9 },
    ],
    total: 170.25,
    estimatedProfit: 39.25,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 23 — Ravy Mart — PARTIAL ──
  {
    id: saleId(23),
    receiptNumber: "R-2023",
    customerId: "c8",
    date: "2026-04-27",
    items: [
      { productId: khmaoDomId("6 x 14"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 12.25, avgCostAtSale: 9.5 },
      { productId: pornLorId("9 x 18"), quantity: 4, unit: "បេ", stockQuantity: 4, unitPrice: 13.75, avgCostAtSale: 11 },
    ],
    total: 104,
    estimatedProfit: 17,
    paidAmount: 55,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 24 — Kimly Store — UNPAID ──
  {
    id: saleId(24),
    receiptNumber: "R-2024",
    customerId: "c6",
    date: "2026-04-28",
    items: [
      { productId: pornLorId("12 x 20"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 17.75, avgCostAtSale: 14 },
    ],
    total: 53.25,
    estimatedProfit: 11.25,
    paidAmount: 0,
    paymentStatus: "unpaid",
    telegramStatus: "not_sent",
  },
  // ── Sale 25 — Pich Wholesale — PARTIAL ──
  {
    id: saleId(25),
    receiptNumber: "R-2025",
    customerId: "c7",
    date: "2026-04-29",
    items: [
      { productId: khmaoDomId("9 x 18"), quantity: 5, unit: "បេ", stockQuantity: 5, unitPrice: 16.75, avgCostAtSale: 13.5 },
      { productId: pornLorId("16 x 28"), quantity: 2, unit: "បេ", stockQuantity: 2, unitPrice: 26.5, avgCostAtSale: 21 },
    ],
    total: 136.75,
    estimatedProfit: 26.25,
    paidAmount: 70,
    paymentStatus: "partial",
    telegramStatus: "not_sent",
  },
  // ── Sale 26 — Ravy Mart — PAID ──
  {
    id: saleId(26),
    receiptNumber: "R-2026",
    customerId: "c8",
    date: "2026-04-30",
    items: [
      { productId: khmaoDomId("6 x 11"), quantity: 6, unit: "បេ", stockQuantity: 6, unitPrice: 10.75, avgCostAtSale: 8.5 },
      { productId: pornLorId("14 x 24"), quantity: 3, unit: "បេ", stockQuantity: 3, unitPrice: 22.5, avgCostAtSale: 17.5 },
    ],
    total: 132,
    estimatedProfit: 26,
    paidAmount: 132,
    paymentStatus: "paid",
    telegramStatus: "customer",
  },
];

/* ── Seed Customer Prices (last-known prices from sales) ──── */
const seedCustomerPrices: AppState["customerPrices"] = [
  { customerId: "c1", productId: khmaoDomId("5 x 9"), price: 9.5 },
  { customerId: "c1", productId: khmaoDomId("6 x 11"), price: 10.5 },
  { customerId: "c1", productId: khmaoDomId("6 x 14"), price: 12 },
  { customerId: "c1", productId: pornLorId("6 x 11"), price: 8.5 },
  { customerId: "c1", productId: pornLorId("9 x 18"), price: 13.5 },
  { customerId: "c2", productId: khmaoDomId("8 x 15"), price: 14 },
  { customerId: "c2", productId: khmaoDomId("9 x 18"), price: 16.5 },
  { customerId: "c2", productId: pornLorId("6 x 11"), price: 8.5 },
  { customerId: "c2", productId: pornLorId("12 x 20"), price: 17.5 },
  { customerId: "c2", productId: pornLorId("16 x 28"), price: 26 },
  { customerId: "c3", productId: pornLorId("6 x 11"), price: 8.5 },
  { customerId: "c3", productId: pornLorId("8 x 15"), price: 11.5 },
  { customerId: "c3", productId: khmaoDomId("5 x 9"), price: 9.5 },
  { customerId: "c3", productId: khmaoDomId("12 x 20"), price: 21 },
  { customerId: "c3", productId: pornLorId("14 x 24"), price: 22 },
  { customerId: "c4", productId: pornLorId("6 x 14"), price: 9.5 },
  { customerId: "c4", productId: pornLorId("8 x 15"), price: 11.5 },
  { customerId: "c4", productId: khmaoDomId("6 x 11"), price: 10.5 },
  { customerId: "c4", productId: khmaoDomId("6 x 14"), price: 12 },
  { customerId: "c4", productId: khmaoDomId("8 x 15"), price: 14 },
  { customerId: "c4", productId: khmaoDomId("5 x 9"), price: 9.5 },
  { customerId: "c4", productId: pornLorId("16 x 28"), price: 26 },
  { customerId: "c5", productId: khmaoDomId("12 x 20"), price: 21 },
  { customerId: "c5", productId: pornLorId("14 x 24"), price: 22 },
  { customerId: "c5", productId: pornLorId("6 x 14"), price: 9.5 },
  { customerId: "c5", productId: khmaoDomId("6 x 14"), price: 12 },
  { customerId: "c5", productId: pornLorId("8 x 15"), price: 11.5 },
  { customerId: "c6", productId: khmaoDomId("5 x 9"), price: 9.75 },
  { customerId: "c6", productId: pornLorId("6 x 11"), price: 8.75 },
  { customerId: "c6", productId: pornLorId("12 x 20"), price: 17.75 },
  { customerId: "c7", productId: khmaoDomId("8 x 15"), price: 14.25 },
  { customerId: "c7", productId: pornLorId("8 x 15"), price: 11.75 },
  { customerId: "c7", productId: khmaoDomId("9 x 18"), price: 16.75 },
  { customerId: "c7", productId: pornLorId("16 x 28"), price: 26.5 },
  { customerId: "c8", productId: khmaoDomId("6 x 14"), price: 12.25 },
  { customerId: "c8", productId: pornLorId("9 x 18"), price: 13.75 },
  { customerId: "c8", productId: khmaoDomId("6 x 11"), price: 10.75 },
  { customerId: "c8", productId: pornLorId("14 x 24"), price: 22.5 },
];

/* ── Seed Payments ──────────────────────────────────────────── */
const seedPayments: AppState["payments"] = [
  // Paid sales — full payments
  { id: "pay_s1", customerId: "c1", saleId: saleId(1), amount: 79, date: "2026-03-01" },
  { id: "pay_s2", customerId: "c2", saleId: saleId(2), amount: 89, date: "2026-03-03" },
  { id: "pay_s5", customerId: "c5", saleId: saleId(5), amount: 63, date: "2026-03-10" },
  { id: "pay_s8", customerId: "c3", saleId: saleId(8), amount: 76, date: "2026-03-16" },
  { id: "pay_s9", customerId: "c4", saleId: saleId(9), amount: 99, date: "2026-03-18" },
  { id: "pay_s11", customerId: "c1", saleId: saleId(11), amount: 102, date: "2026-03-25" },
  { id: "pay_s13", customerId: "c3", saleId: saleId(13), amount: 69, date: "2026-04-01" },
  { id: "pay_s16", customerId: "c1", saleId: saleId(16), amount: 109.5, date: "2026-04-10" },
  { id: "pay_s17", customerId: "c2", saleId: saleId(17), amount: 127.5, date: "2026-04-14" },
  { id: "pay_s19", customerId: "c4", saleId: saleId(19), amount: 78, date: "2026-04-22" },
  { id: "pay_s21", customerId: "c6", saleId: saleId(21), amount: 102.25, date: "2026-04-26" },
  { id: "pay_s26", customerId: "c8", saleId: saleId(26), amount: 132, date: "2026-04-30" },
  // Partial payments
  { id: "pay_s4", customerId: "c4", saleId: saleId(4), amount: 80, date: "2026-03-07" },
  { id: "pay_s6", customerId: "c1", saleId: saleId(6), amount: 50, date: "2026-03-12" },
  { id: "pay_s12", customerId: "c2", saleId: saleId(12), amount: 60, date: "2026-03-28" },
  { id: "pay_s15", customerId: "c5", saleId: saleId(15), amount: 30, date: "2026-04-05" },
  { id: "pay_s18", customerId: "c3", saleId: saleId(18), amount: 40, date: "2026-04-18" },
  { id: "pay_s23", customerId: "c8", saleId: saleId(23), amount: 55, date: "2026-04-27" },
  { id: "pay_s25", customerId: "c7", saleId: saleId(25), amount: 70, date: "2026-04-29" },
];

export const seedData: AppState = {
  shopName: "Family Plastic Co.",
  categories: normalizeCategories(DEFAULT_CATEGORIES, seedProducts, { includeDefaults: true }),
  markets: normalizeMarkets(undefined, seedCustomers),
  products: seedProducts,
  factories: seedFactories,
  customers: seedCustomers,
  stockIns: seedStockIns,
  sales: seedSales,
  customerPrices: seedCustomerPrices,
  payments: seedPayments,
};
