import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LEGACY_SAMPLE_PRODUCT_IDS, seedData } from "./mock-data";
import type {
  AppState,
  BuyerAccount,
  BuyerOrder,
  BuyerOrderStatus,
  Customer,
  CustomerPrice,
  Factory,
  Payment,
  PaymentStatus,
  Product,
  ProductCategory,
  ProductCostLayer,
  ProductSaleSubUnit,
  ProductVariant,
  Sale,
  SaleItem,
  StockInInvoice,
  StockInItem,
} from "./types";
import { normalizeCategories, normalizeCategoryName, sameCategoryName } from "./categories";
import { normalizeMarketName, normalizeMarkets, sameMarketName } from "./markets";
import {
  convertSaleQuantityToStockQuantity,
  getSaleUnitQuantityPerStockUnit,
  normalizeProductSaleSubUnits,
  normalizeSaleUnit,
  resolveSaleItemStockQuantity,
  resolveSaleItemUnit,
  shouldLimitSaleSubUnitToSingleStockUnit,
} from "./sale-units";
import { getTelegramUrl, normalizeTelegramValue } from "./telegram";
import { formatUnits, normalizeProductUnits, primaryUnit } from "./units";
import {
  canSyncRemoteState,
  loadRemoteState,
  saveRemoteState,
  subscribeRemoteState,
} from "./remote-state";

const STORAGE_KEY = "wms_state_v1";
const FALLBACK_CATEGORY_NAME = "ផ្សេងៗ";
const FALLBACK_MARKET_NAME = "ផ្សេងៗ";
const LEGACY_SAMPLE_PRODUCT_ID_SET = new Set<string>(LEGACY_SAMPLE_PRODUCT_IDS);
const THANG_SOR_DOM_SIZE_PRODUCTS = [
  "ថង់សរដុំ 6 x 11 ឃ្លោក",
  "ថង់សរដុំ 6 x 14 ឃ្លោក",
  "ថង់សរដុំ 8 x 15 ឃ្លោក",
  "ថង់សរដុំ 9 x 18 ឃ្លោក",
  "ថង់សរដុំ 12 x 20 ឃ្លោក",
] as const;
const THANG_KHMAO_DOM_SIZE_PRODUCTS = [
  "ថង់ខ្មៅដុំ 5 x 9 ឃ្លោក",
  "ថង់ខ្មៅដុំ 6 x 11 ឃ្លោក",
  "ថង់ខ្មៅដុំ 6 x 14 ឃ្លោក",
  "ថង់ខ្មៅដុំ 8 x 15 ឃ្លោក",
  "ថង់ខ្មៅដុំ 9 x 18 ឃ្លោក",
  "ថង់ខ្មៅដុំ 12 x 20 ឃ្លោក",
] as const;
const THANG_PORN_LOR_SIZE_PRODUCTS = [
  "ថង់ពណ៌ 6 x 11 ល្អ",
  "ថង់ពណ៌ 6 x 14 ល្អ",
  "ថង់ពណ៌ 8 x 15 ល្អ",
  "ថង់ពណ៌ 9 x 18 ល្អ",
  "ថង់ពណ៌ 12 x 20 ល្អ",
  "ថង់ពណ៌ 14 x 24 ល្អ",
  "ថង់ពណ៌ 16 x 28 ល្អ",
] as const;
const PRESET_SIZE_GROUPS = [
  { idPrefix: "preset_thang_sor_dom", names: THANG_SOR_DOM_SIZE_PRODUCTS },
  { idPrefix: "preset_thang_khmao_dom", names: THANG_KHMAO_DOM_SIZE_PRODUCTS },
  { idPrefix: "preset_thang_porn_lor", names: THANG_PORN_LOR_SIZE_PRODUCTS },
] as const;
const BUYER_ORDER_STATUSES = new Set<BuyerOrderStatus>([
  "pending",
  "confirmed",
  "packing",
  "completed",
  "cancelled",
]);
const PAYMENT_STATUSES = new Set<PaymentStatus>(["paid", "unpaid", "partial"]);

type StoreResult = { ok: true } | { ok: false; error: string };

type InventoryEffect = { quantity: number; basis: number };

type InventoryRecalculationResult =
  | { ok: true; products: Product[]; sales: Sale[] }
  | { ok: false; error: string };

function roundInventoryQuantity(value: number) {
  return Number(value.toFixed(4));
}

function roundInventoryMoney(value: number) {
  return Number(value.toFixed(4));
}

function normalizeInventoryLayers(layers: ProductCostLayer[]) {
  const grouped = new Map<string, ProductCostLayer>();

  for (const layer of layers) {
    const quantity = roundInventoryQuantity(Math.max(layer.quantity, 0));
    const unitCost = roundInventoryMoney(Math.max(layer.unitCost, 0));

    if (quantity <= 0.0001) continue;

    const key = unitCost.toFixed(4);
    const current = grouped.get(key) ?? { quantity: 0, unitCost };
    grouped.set(key, {
      quantity: roundInventoryQuantity(current.quantity + quantity),
      unitCost,
    });
  }

  return Array.from(grouped.values()).sort((a, b) => b.unitCost - a.unitCost);
}

function calculateProductMetricsFromLayers(layers: ProductCostLayer[]) {
  const normalizedLayers = normalizeInventoryLayers(layers);
  const stock = roundInventoryQuantity(
    normalizedLayers.reduce((sum, layer) => sum + layer.quantity, 0),
  );
  const totalCostBasis = roundInventoryMoney(
    normalizedLayers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0),
  );
  const avgCost = normalizedLayers[0]?.unitCost ?? 0;

  return {
    stock,
    totalCostBasis,
    avgCost,
    costLayers: normalizedLayers,
  };
}

function fallbackProductLayers(product: Product) {
  if (Array.isArray(product.costLayers) && product.costLayers.length > 0) {
    return normalizeInventoryLayers(product.costLayers);
  }

  const stock = roundInventoryQuantity(Math.max(product.stock, 0));
  if (stock <= 0.0001) return [];

  const basis =
    product.totalCostBasis > 0.0001
      ? product.totalCostBasis
      : roundInventoryMoney(product.avgCost * stock);
  const unitCost = stock > 0 ? roundInventoryMoney(Math.max(basis / stock, 0)) : 0;

  return normalizeInventoryLayers([{ quantity: stock, unitCost }]);
}

export function getProductCostLayers(product: Product) {
  return fallbackProductLayers(product);
}

function applyLayersToProduct(product: Product, layers: ProductCostLayer[]) {
  return {
    ...product,
    ...calculateProductMetricsFromLayers(layers),
  };
}

function addStockToLayers(layers: ProductCostLayer[], quantity: number, unitCost: number) {
  return normalizeInventoryLayers([...layers, { quantity, unitCost }]);
}

function consumeLayersForSale(layers: ProductCostLayer[], quantity: number) {
  const normalizedLayers = normalizeInventoryLayers(layers);
  let remaining = roundInventoryQuantity(Math.max(quantity, 0));
  let consumedBasis = 0;
  const nextLayers: ProductCostLayer[] = [];

  for (const layer of normalizedLayers) {
    if (remaining <= 0.0001) {
      nextLayers.push(layer);
      continue;
    }

    const consumed = Math.min(layer.quantity, remaining);
    const leftover = roundInventoryQuantity(layer.quantity - consumed);

    consumedBasis += consumed * layer.unitCost;
    remaining = roundInventoryQuantity(remaining - consumed);

    if (leftover > 0.0001) {
      nextLayers.push({ ...layer, quantity: leftover });
    }
  }

  if (remaining > 0.0001) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    layers: normalizeInventoryLayers(nextLayers),
    consumedBasis: roundInventoryMoney(consumedBasis),
  };
}

export function simulateDraftSale(
  products: Product[],
  draftItems: Array<{
    productId: string;
    quantity: number;
    unit?: SaleItem["unit"];
    unitPrice: number;
  }>,
) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const nextLayersByProduct = new Map<string, ProductCostLayer[]>();
  const items: SaleItem[] = [];

  for (const draftItem of draftItems) {
    const product = productById.get(draftItem.productId);
    if (!product) {
      return {
        ok: false as const,
        error: "Product not found",
      };
    }

    const saleUnit = normalizeSaleUnit(product, draftItem.unit);
    const stockQuantity = convertSaleQuantityToStockQuantity(product, draftItem.quantity, saleUnit);
    const currentLayers =
      nextLayersByProduct.get(draftItem.productId) ?? fallbackProductLayers(product);
    const consumed = consumeLayersForSale(currentLayers, stockQuantity);

    if (!consumed.ok) {
      return {
        ok: false as const,
        error: `Not enough stock for ${product.name} (have ${product.stock})`,
      };
    }

    nextLayersByProduct.set(draftItem.productId, consumed.layers);
    items.push({
      productId: draftItem.productId,
      quantity: draftItem.quantity,
      unit: saleUnit,
      stockQuantity,
      unitPrice: draftItem.unitPrice,
      avgCostAtSale:
        draftItem.quantity > 0
          ? roundInventoryMoney(consumed.consumedBasis / Math.max(draftItem.quantity, 0.0001))
          : 0,
    });
  }

  const total = Number(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2),
  );
  const estimatedProfit = Number(
    items
      .reduce((sum, item) => {
        if (item.unitPrice <= 0 || item.quantity <= 0) return sum;
        return sum + (item.unitPrice - item.avgCostAtSale) * item.quantity;
      }, 0)
      .toFixed(2),
  );

  return {
    ok: true as const,
    items,
    products: products.map((product) => {
      const nextLayers = nextLayersByProduct.get(product.id);
      return nextLayers ? applyLayersToProduct(product, nextLayers) : product;
    }),
    total,
    estimatedProfit,
  };
}

function accumulateStockInEffects(stockIns: StockInInvoice[]) {
  const totals = new Map<string, InventoryEffect>();

  stockIns.forEach((invoice) => {
    invoice.items.forEach((item) => {
      const current = totals.get(item.productId) ?? { quantity: 0, basis: 0 };
      totals.set(item.productId, {
        quantity: current.quantity + item.quantity,
        basis: current.basis + item.quantity * item.buyPrice,
      });
    });
  });

  return totals;
}

function accumulateSaleEffects(sales: Sale[]) {
  const totals = new Map<string, InventoryEffect>();

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = totals.get(item.productId) ?? { quantity: 0, basis: 0 };
      totals.set(item.productId, {
        quantity: current.quantity + (item.stockQuantity ?? item.quantity),
        basis: current.basis + item.quantity * item.avgCostAtSale,
      });
    });
  });

  return totals;
}

function buildInventoryBaseline(products: Product[], stockIns: StockInInvoice[], sales: Sale[]) {
  const stockInEffects = accumulateStockInEffects(stockIns);
  const saleEffects = accumulateSaleEffects(sales);

  return new Map(
    products.map((product) => {
      const purchased = stockInEffects.get(product.id) ?? { quantity: 0, basis: 0 };
      const sold = saleEffects.get(product.id) ?? { quantity: 0, basis: 0 };

      return [
        product.id,
        {
          quantity: product.stock - purchased.quantity + sold.quantity,
          basis: product.totalCostBasis - purchased.basis + sold.basis,
        },
      ];
    }),
  );
}

function buildOpeningInventoryLayers(
  products: Product[],
  stockIns: StockInInvoice[],
  sales: Sale[],
): InventoryRecalculationResult {
  const baseline = buildInventoryBaseline(products, stockIns, sales);

  const productMap = new Map<string, Product>();

  for (const product of products) {
    const opening = baseline.get(product.id) ?? { quantity: 0, basis: 0 };

    if (opening.quantity < -0.0001) {
      return {
        ok: false,
        error: `Updating invoices would make stock negative for ${product.name}.`,
      };
    }

    if (opening.basis < -0.0001) {
      return {
        ok: false,
        error: `Updating invoices would make cost basis negative for ${product.name}.`,
      };
    }

    const openingLayers =
      opening.quantity <= 0.0001
        ? []
        : [
            {
              quantity: roundInventoryQuantity(opening.quantity),
              unitCost: roundInventoryMoney(
                Math.max(opening.basis / Math.max(opening.quantity, 0.0001), 0),
              ),
            },
          ];

    productMap.set(product.id, applyLayersToProduct(product, openingLayers));
  }

  const transactions = [
    ...[...stockIns].reverse().map((invoice, order) => ({
      kind: "stock_in" as const,
      date: invoice.date,
      order,
      invoice,
    })),
    ...[...sales].reverse().map((sale, order) => ({
      kind: "sale" as const,
      date: sale.date,
      order,
      sale,
    })),
  ].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    if (a.kind !== b.kind) {
      return a.kind === "stock_in" ? -1 : 1;
    }

    return a.order - b.order;
  });

  const recalculatedSales: Sale[] = [];

  for (const transaction of transactions) {
    if (transaction.kind === "stock_in") {
      transaction.invoice.items.forEach((item) => {
        const product = productMap.get(item.productId);
        if (!product) return;

        productMap.set(
          item.productId,
          applyLayersToProduct(
            product,
            addStockToLayers(fallbackProductLayers(product), item.quantity, item.buyPrice),
          ),
        );
      });
      continue;
    }

    const nextItems: SaleItem[] = [];
    let total = 0;
    let estimatedProfit = 0;

    for (const item of transaction.sale.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        nextItems.push(item);
        total += item.quantity * item.unitPrice;
        estimatedProfit += (item.unitPrice - item.avgCostAtSale) * item.quantity;
        continue;
      }

      const saleUnit = resolveSaleItemUnit(item, product);
      const stockQuantity = resolveSaleItemStockQuantity(item, product);
      const consumed = consumeLayersForSale(fallbackProductLayers(product), stockQuantity);
      if (!consumed.ok) {
        return {
          ok: false,
          error: `Updating invoices would make stock negative for ${product.name}.`,
        };
      }

      productMap.set(item.productId, applyLayersToProduct(product, consumed.layers));

      const nextItem: SaleItem = {
        ...item,
        unit: saleUnit,
        stockQuantity,
        avgCostAtSale:
          item.quantity > 0
            ? roundInventoryMoney(consumed.consumedBasis / Math.max(item.quantity, 0.0001))
            : 0,
      };

      nextItems.push(nextItem);
      total += nextItem.quantity * nextItem.unitPrice;
      estimatedProfit += (nextItem.unitPrice - nextItem.avgCostAtSale) * nextItem.quantity;
    }

    const nextTotal = Number(total.toFixed(2));
    const paidAmount = Number(Math.min(transaction.sale.paidAmount, nextTotal).toFixed(2));
    const paymentStatus = paidAmount <= 0 ? "unpaid" : paidAmount >= nextTotal ? "paid" : "partial";

    recalculatedSales.push({
      ...transaction.sale,
      items: nextItems,
      total: nextTotal,
      estimatedProfit: Number(estimatedProfit.toFixed(2)),
      paidAmount,
      paymentStatus,
    });
  }

  return {
    ok: true,
    products: products.map(
      (product) => productMap.get(product.id) ?? applyLayersToProduct(product, []),
    ),
    sales: recalculatedSales.reverse(),
  };
}

function normalizeProducts(products: Product[]) {
  return products.map((product) => {
    const unit = normalizeProductUnits(product.unit);
    const saleSubUnits = normalizeProductSaleSubUnits({
      ...product,
      unit,
    });

    return {
      ...product,
      category: normalizeCategoryName(product.category),
      unit,
      saleSubUnits: saleSubUnits.length > 0 ? saleSubUnits : undefined,
      saleSubUnit: undefined,
      ...calculateProductMetricsFromLayers(fallbackProductLayers(product)),
    };
  });
}

function normalizeCustomers(customers: Customer[]) {
  return customers.map((customer) => ({
    ...customer,
    market: normalizeMarketName(customer.market),
    telegram: customer.telegram ? normalizeTelegramValue(customer.telegram) : undefined,
  }));
}

function normalizeBuyerAccounts(buyers: BuyerAccount[]) {
  return buyers
    .map((buyer) => {
      const email = normalizeEmail(buyer.email);
      return {
        ...buyer,
        email,
        name: buyer.name.trim(),
        market: normalizeMarketName(buyer.market),
        location: buyer.location.trim(),
        phone: buyer.phone?.trim() || undefined,
        telegram: buyer.telegram ? normalizeTelegramValue(buyer.telegram) : undefined,
        customerId:
          buyer.id === "buyer_demo" && email === "customer@gmail.com" ? "c1" : buyer.customerId,
      };
    })
    .filter(
      (buyer) => buyer.id && buyer.email && buyer.passwordDigest && buyer.name && buyer.customerId,
    );
}

function normalizeBuyerOrders(orders: BuyerOrder[]) {
  return orders
    .map((order) => {
      const totalEstimate = Number(Math.max(order.totalEstimate ?? 0, 0).toFixed(2));
      const paidAmount = Number(
        Math.min(Math.max(order.paidAmount ?? 0, 0), totalEstimate).toFixed(2),
      );
      const paymentStatus = PAYMENT_STATUSES.has(order.paymentStatus)
        ? order.paymentStatus
        : paidAmount <= 0
          ? "unpaid"
          : paidAmount >= totalEstimate
            ? "paid"
            : "partial";

      return {
        ...order,
        status: BUYER_ORDER_STATUSES.has(order.status) ? order.status : ("pending" as const),
        paymentStatus,
        paidAmount,
        totalEstimate,
        items: Array.isArray(order.items)
          ? order.items
              .map((item) => ({
                ...item,
                quantity: Number(Math.max(item.quantity ?? 0, 0)),
                stockQuantity: Number(Math.max(item.stockQuantity ?? 0, 0)),
                estimatedUnitPrice:
                  item.estimatedUnitPrice === undefined
                    ? undefined
                    : Number(Math.max(item.estimatedUnitPrice, 0).toFixed(2)),
              }))
              .filter((item) => item.productId && item.quantity > 0 && item.stockQuantity > 0)
          : [],
      };
    })
    .filter((order) => order.id && order.buyerId && order.customerId && order.items.length > 0);
}

function findSuggestedPrice(
  state: Pick<AppState, "customerPrices" | "sales">,
  customerId: string,
  productId: string,
  unit?: SaleItem["unit"],
) {
  const exactMatch = state.customerPrices.find(
    (price) =>
      price.customerId === customerId && price.productId === productId && price.unit === unit,
  );
  if (exactMatch) return exactMatch.price;

  const fallbackMatch = state.customerPrices.find(
    (price) =>
      price.customerId === customerId && price.productId === productId && price.unit === undefined,
  );

  if (fallbackMatch) return fallbackMatch.price;

  for (const sale of state.sales) {
    if (sale.customerId !== customerId) continue;

    const matchingItem = sale.items.find((item) => item.productId === productId);
    if (matchingItem) return matchingItem.unitPrice;
  }

  return undefined;
}

type BuyerPriceSource = "customer" | "market" | "estimate";

export type BuyerVisiblePrice = {
  price: number;
  source: BuyerPriceSource;
};

function roundDisplayPrice(value: number) {
  return Number(value.toFixed(2));
}

function convertSaleUnitPrice(
  product: Product,
  price: number,
  fromUnit?: SaleItem["unit"],
  toUnit?: SaleItem["unit"],
) {
  const fromQuantity = getSaleUnitQuantityPerStockUnit(product, fromUnit);
  const toQuantity = getSaleUnitQuantityPerStockUnit(product, toUnit);
  if (toQuantity <= 0) return roundDisplayPrice(price);
  return roundDisplayPrice((price * fromQuantity) / toQuantity);
}

function findPriceFromCustomerPrices(
  product: Product,
  prices: CustomerPrice[],
  unit?: SaleItem["unit"],
) {
  const normalizedUnit = normalizeSaleUnit(product, unit);
  const exactMatch = prices.find(
    (price) =>
      price.productId === product.id && normalizeSaleUnit(product, price.unit) === normalizedUnit,
  );
  const fallbackMatch = prices.find((price) => price.productId === product.id);
  const match = exactMatch ?? fallbackMatch;
  if (!match) return undefined;

  return convertSaleUnitPrice(product, match.price, match.unit, normalizedUnit);
}

function findPriceFromSales(product: Product, sales: Sale[], unit?: SaleItem["unit"]) {
  const normalizedUnit = normalizeSaleUnit(product, unit);

  for (const sale of sales) {
    const exactMatch = sale.items.find(
      (item) =>
        item.productId === product.id && normalizeSaleUnit(product, item.unit) === normalizedUnit,
    );
    const fallbackMatch = sale.items.find((item) => item.productId === product.id);
    const match = exactMatch ?? fallbackMatch;
    if (match) {
      return convertSaleUnitPrice(product, match.unitPrice, match.unit, normalizedUnit);
    }
  }

  return undefined;
}

function findBuyerVisiblePrice(
  state: Pick<AppState, "customerPrices" | "products" | "sales">,
  customerId: string,
  productId: string,
  unit?: SaleItem["unit"],
): BuyerVisiblePrice | undefined {
  const product = state.products.find((candidate) => candidate.id === productId);
  if (!product) return undefined;

  const customerPrices = state.customerPrices.filter((price) => price.customerId === customerId);
  const customerPrice = findPriceFromCustomerPrices(product, customerPrices, unit);
  if (customerPrice !== undefined) {
    return { price: customerPrice, source: "customer" };
  }

  const customerSalePrice = findPriceFromSales(
    product,
    state.sales.filter((sale) => sale.customerId === customerId),
    unit,
  );
  if (customerSalePrice !== undefined) {
    return { price: customerSalePrice, source: "customer" };
  }

  const marketPrice = findPriceFromCustomerPrices(product, state.customerPrices, unit);
  if (marketPrice !== undefined) {
    return { price: marketPrice, source: "market" };
  }

  const marketSalePrice = findPriceFromSales(product, state.sales, unit);
  if (marketSalePrice !== undefined) {
    return { price: marketSalePrice, source: "market" };
  }

  if (product.avgCost > 0) {
    const normalizedUnit = normalizeSaleUnit(product, unit);
    const price = convertSaleUnitPrice(product, product.avgCost * 1.25, undefined, normalizedUnit);
    return { price, source: "estimate" };
  }

  return undefined;
}

function productNameKey(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

interface DedupeResult {
  products: Product[];
  idRemap: Map<string, string>;
}

function dedupeProductsByName(products: Product[]): DedupeResult {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = productNameKey(product.name);
    const group = groups.get(key);
    if (group) group.push(product);
    else groups.set(key, [product]);
  }

  const idRemap = new Map<string, string>();
  const deduped: Product[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    const preferred = group.find((product) => product.id.startsWith("preset_")) ?? group[0];
    deduped.push(preferred);
    for (const product of group) {
      if (product.id !== preferred.id) idRemap.set(product.id, preferred.id);
    }
  }

  return { products: deduped, idRemap };
}

function remapStockInProductIds(stockIns: StockInInvoice[], idRemap: Map<string, string>) {
  if (idRemap.size === 0) return stockIns;
  return stockIns.map((invoice) => ({
    ...invoice,
    items: invoice.items.map((item) => ({
      ...item,
      productId: idRemap.get(item.productId) ?? item.productId,
    })),
  }));
}

function remapSaleProductIds(sales: Sale[], idRemap: Map<string, string>) {
  if (idRemap.size === 0) return sales;
  return sales.map((sale) => ({
    ...sale,
    items: sale.items.map((item) => ({
      ...item,
      productId: idRemap.get(item.productId) ?? item.productId,
    })),
  }));
}

function remapCustomerPriceProductIds(prices: CustomerPrice[], idRemap: Map<string, string>) {
  if (idRemap.size === 0) return prices;
  return prices.map((price) => ({
    ...price,
    productId: idRemap.get(price.productId) ?? price.productId,
  }));
}

function buildPresetProductId(idPrefix: string, name: string) {
  const sizeKey =
    name
      .match(/(\d+\s*x\s*\d+)/i)?.[1]
      ?.replace(/\s+/g, "")
      .toLocaleLowerCase() ?? "item";
  return `${idPrefix}_${sizeKey}`;
}

function expandPresetSizeProducts(products: Product[]) {
  let result = products;

  for (const group of PRESET_SIZE_GROUPS) {
    const matchingProducts = result.filter((product) =>
      group.names.some((name) => productNameKey(product.name) === productNameKey(name)),
    );

    if (matchingProducts.length === 0) continue;

    const template = matchingProducts[0];
    const existingNames = new Set(result.map((product) => productNameKey(product.name)));
    const missingProducts = group.names
      .filter((name) => !existingNames.has(productNameKey(name)))
      .map((name) => {
        const id = buildPresetProductId(group.idPrefix, name);
        return {
          ...template,
          id,
          name,
          variants: template.variants.map((variant, index) => ({
            ...variant,
            id: `${id}_variant_${index + 1}`,
          })),
        };
      });

    if (missingProducts.length > 0) {
      result = [...result, ...missingProducts];
    }
  }

  return result;
}

function pruneLegacySampleData(state: AppState): AppState {
  const removedProductIds = new Set(
    state.products
      .filter((product) => LEGACY_SAMPLE_PRODUCT_ID_SET.has(product.id))
      .map((product) => product.id),
  );

  if (removedProductIds.size === 0) return state;

  const products = state.products.filter((product) => !removedProductIds.has(product.id));
  const stockIns = state.stockIns
    .map((invoice) => {
      const items = invoice.items.filter((item) => !removedProductIds.has(item.productId));
      return {
        ...invoice,
        items,
        total: Number(
          items.reduce((sum, item) => sum + item.quantity * item.buyPrice, 0).toFixed(4),
        ),
      };
    })
    .filter((invoice) => invoice.items.length > 0);

  const removedSaleIds = new Set<string>();
  const sales = state.sales
    .map((sale) => {
      const items = sale.items.filter((item) => !removedProductIds.has(item.productId));
      if (items.length === 0) {
        removedSaleIds.add(sale.id);
        return null;
      }

      const total = Number(
        items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(4),
      );
      const estimatedProfit = Number(
        items
          .reduce((sum, item) => sum + item.quantity * (item.unitPrice - item.avgCostAtSale), 0)
          .toFixed(4),
      );
      const paidAmount = Number(Math.min(sale.paidAmount, total).toFixed(4));
      const paymentStatus = paidAmount <= 0 ? "unpaid" : paidAmount >= total ? "paid" : "partial";

      return { ...sale, items, total, estimatedProfit, paidAmount, paymentStatus };
    })
    .filter((sale): sale is Sale => sale !== null);

  return {
    ...state,
    products,
    stockIns,
    sales,
    customerPrices: state.customerPrices.filter((price) => !removedProductIds.has(price.productId)),
    payments: state.payments.filter((payment) => !removedSaleIds.has(payment.saleId ?? "")),
  };
}

function isUninitializedProduct(product: Product) {
  const hasLayers = Array.isArray(product.costLayers) && product.costLayers.length > 0;
  return !hasLayers && product.stock <= 0.0001 && product.totalCostBasis <= 0.0001;
}

function applySeedPresetProducts(products: Product[]) {
  const seedById = new Map(seedData.products.map((product) => [product.id, product]));
  const replaced = products.map((product) => {
    const seedProduct = seedById.get(product.id);
    if (!seedProduct) return product;
    return isUninitializedProduct(product) ? { ...seedProduct } : product;
  });
  const existingIds = new Set(replaced.map((product) => product.id));
  const additions = seedData.products
    .filter((seedProduct) => !existingIds.has(seedProduct.id))
    .map((seedProduct) => ({ ...seedProduct }));
  return additions.length > 0 ? [...replaced, ...additions] : replaced;
}

function mergeMissingSeedStockIns(stockIns: StockInInvoice[]) {
  const existingIds = new Set(stockIns.map((invoice) => invoice.id));
  const existingInvoiceNumbers = new Set(
    stockIns.map((invoice) => invoice.invoiceNumber.trim().toLocaleLowerCase()),
  );
  const missing = seedData.stockIns.filter(
    (invoice) =>
      !existingIds.has(invoice.id) &&
      !existingInvoiceNumbers.has(invoice.invoiceNumber.trim().toLocaleLowerCase()),
  );
  return missing.length > 0 ? [...stockIns, ...missing] : stockIns;
}

function mergeMissingSeedFactories(factories: Factory[]) {
  const existingIds = new Set(factories.map((factory) => factory.id));
  const missing = seedData.factories.filter((factory) => !existingIds.has(factory.id));
  return missing.length > 0 ? [...factories, ...missing] : factories;
}

function mergeMissingSeedBuyerCustomers(customers: Customer[]) {
  const seedBuyerCustomerIds = new Set(
    seedData.buyerAccounts.map((buyerAccount) => buyerAccount.customerId),
  );
  const existingIds = new Set(customers.map((customer) => customer.id));
  const missing = seedData.customers.filter(
    (customer) => seedBuyerCustomerIds.has(customer.id) && !existingIds.has(customer.id),
  );
  return missing.length > 0 ? [...customers, ...missing] : customers;
}

function mergeMissingSeedBuyerAccounts(buyerAccounts: BuyerAccount[]) {
  const existingEmails = new Set(buyerAccounts.map((buyerAccount) => buyerAccount.email));
  const missing = seedData.buyerAccounts.filter(
    (buyerAccount) => !existingEmails.has(buyerAccount.email),
  );
  return missing.length > 0 ? [...buyerAccounts, ...missing] : buyerAccounts;
}

function normalizeAppState(state: AppState): AppState {
  const prunedState = pruneLegacySampleData(state);
  const customers = normalizeCustomers(mergeMissingSeedBuyerCustomers(prunedState.customers));
  const buyerAccounts = normalizeBuyerAccounts(
    mergeMissingSeedBuyerAccounts(prunedState.buyerAccounts ?? []),
  );
  const buyerOrders = normalizeBuyerOrders(prunedState.buyerOrders ?? []);
  const factories = mergeMissingSeedFactories(prunedState.factories);
  const mergedProducts = expandPresetSizeProducts(
    normalizeProducts(applySeedPresetProducts(prunedState.products)),
  );
  const { products: dedupedProducts, idRemap } = dedupeProductsByName(mergedProducts);
  const remappedStockIns = remapStockInProductIds(prunedState.stockIns, idRemap);
  const remappedSales = remapSaleProductIds(prunedState.sales, idRemap);
  const remappedCustomerPrices = remapCustomerPriceProductIds(prunedState.customerPrices, idRemap);
  const baseProductIds = new Set(dedupedProducts.map((product) => product.id));
  const stockIns = mergeMissingSeedStockIns(remappedStockIns).filter((invoice) =>
    invoice.items.every((item) => baseProductIds.has(item.productId)),
  );
  const recalculatedInventory = buildOpeningInventoryLayers(
    dedupedProducts,
    stockIns,
    remappedSales,
  );
  const products = recalculatedInventory.ok ? recalculatedInventory.products : dedupedProducts;
  const sales = recalculatedInventory.ok ? recalculatedInventory.sales : remappedSales;

  return {
    ...prunedState,
    customers,
    buyerAccounts,
    buyerOrders,
    buyerSessionId: buyerAccounts.some((buyer) => buyer.id === prunedState.buyerSessionId)
      ? prunedState.buyerSessionId
      : undefined,
    factories,
    markets: normalizeMarkets(prunedState.markets, [...customers, ...buyerAccounts]),
    products,
    stockIns,
    sales,
    customerPrices: remappedCustomerPrices,
    categories: normalizeCategories(prunedState.categories, products),
  };
}

function hydrateState(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return seedData;

  const parsed = raw as Partial<AppState> & {
    categories?: Array<ProductCategory | string>;
    markets?: string[];
  };
  const customers = Array.isArray(parsed.customers)
    ? normalizeCustomers(parsed.customers as Customer[])
    : seedData.customers;
  const products = Array.isArray(parsed.products)
    ? normalizeProducts(parsed.products as Product[])
    : seedData.products;

  const nextState = {
    ...seedData,
    ...parsed,
    customers,
    products,
    markets: normalizeMarkets(parsed.markets, customers),
    categories: Array.isArray(parsed.categories)
      ? normalizeCategories(parsed.categories, products)
      : normalizeCategories(seedData.categories, products, { includeDefaults: true }),
  };

  return normalizeAppState(nextState);
}

function loadState(): AppState {
  if (typeof window === "undefined") return seedData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData;
    return hydrateState(JSON.parse(raw));
  } catch {
    return seedData;
  }
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayIsoString() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Customer";

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function getBuyerPasswordDigest(password: string) {
  let hash = 5381;
  for (let index = 0; index < password.length; index += 1) {
    hash = (hash * 33) ^ password.charCodeAt(index);
  }
  return `local-${(hash >>> 0).toString(36)}-${password.length}`;
}

interface StoreContextValue {
  state: AppState;
  currentBuyer: BuyerAccount | null;
  reset: () => void;
  // categories
  addCategory: (category: ProductCategory) => StoreResult;
  updateCategory: (currentName: string, category: ProductCategory) => StoreResult;
  deleteCategory: (name: string) => StoreResult;
  // markets
  addMarket: (name: string) => StoreResult;
  updateMarket: (currentName: string, nextName: string) => StoreResult;
  deleteMarket: (name: string) => StoreResult;
  // products
  upsertProduct: (
    p: Omit<Product, "id" | "avgCost" | "stock" | "totalCostBasis" | "costLayers" | "variants"> & {
      id?: string;
      saleSubUnits?: ProductSaleSubUnit[];
      variants?: ProductVariant[];
    },
  ) => void;
  deleteProduct: (id: string) => void;
  addVariant: (productId: string, variant: Omit<ProductVariant, "id">) => void;
  removeVariant: (productId: string, variantId: string) => void;
  // factories
  upsertFactory: (f: Omit<Factory, "id"> & { id?: string }) => void;
  deleteFactory: (id: string) => void;
  // customers
  upsertCustomer: (c: Omit<Customer, "id"> & { id?: string }) => void;
  deleteCustomer: (id: string) => void;
  // buyers
  registerBuyer: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    market: string;
    location: string;
  }) => { ok: true; buyer: BuyerAccount } | { ok: false; error: string };
  signInBuyer: (email: string, password: string) => StoreResult;
  signInBuyerByEmail: (email: string, name?: string | null) => StoreResult;
  signOutBuyer: () => void;
  updateBuyerProfile: (data: {
    name: string;
    phone?: string;
    telegram?: string;
    market: string;
    location?: string;
  }) => StoreResult;
  addBuyerOrder: (data: {
    buyerId: string;
    items: Array<{ productId: string; quantity: number; unit?: SaleItem["unit"] }>;
    notes?: string;
  }) => BuyerOrder | { error: string };
  updateBuyerOrderStatus: (orderId: string, status: BuyerOrderStatus, sellerNote?: string) => void;
  updateBuyerOrderPayment: (
    orderId: string,
    paymentStatus: PaymentStatus,
    paidAmount?: number,
  ) => void;
  setCustomerProductPrices: (
    customerId: string,
    entries: Array<{
      productId: string;
      price: number | null;
    }>,
  ) => void;
  // stock in
  addStockIn: (data: Omit<StockInInvoice, "id" | "total">) => StockInInvoice;
  updateStockIn: (invoiceId: string, data: Omit<StockInInvoice, "id" | "total">) => StoreResult;
  // sales
  addSale: (data: {
    customerId: string;
    date: string;
    items: Array<{
      productId: string;
      quantity: number;
      unit: SaleItem["unit"];
      unitPrice: number;
    }>;
    paidAmount: number;
    paymentStatus: Sale["paymentStatus"];
    notes?: string;
  }) => Sale | { error: string };
  updateSale: (
    saleId: string,
    data: {
      customerId: string;
      date: string;
      items: Array<{
        productId: string;
        quantity: number;
        unit: SaleItem["unit"];
        unitPrice: number;
      }>;
      paidAmount: number;
      paymentStatus: Sale["paymentStatus"];
      notes?: string;
    },
  ) => Sale | { error: string };
  updateSaleTelegram: (saleId: string, status: Sale["telegramStatus"]) => void;
  updateSaleArchive: (saleId: string, archived: boolean) => void;
  recordPayment: (p: Omit<Payment, "id">) => void;
  setShopName: (name: string) => void;
  setShopContact: (contact: { email?: string; telegram?: string }) => StoreResult;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seedData);
  const [hydrated, setHydrated] = useState(false);
  const applyingRemoteStateRef = useRef(false);
  const latestSerializedStateRef = useRef(JSON.stringify(seedData));
  const lastSavedRemoteStateRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    const localState = loadState();
    latestSerializedStateRef.current = JSON.stringify(localState);
    setState(localState);

    if (!canSyncRemoteState()) {
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void loadRemoteState(localState)
      .then((remoteState) => {
        if (cancelled) return;

        const normalizedState = normalizeAppState(remoteState);
        const serializedState = JSON.stringify(normalizedState);
        applyingRemoteStateRef.current = true;
        latestSerializedStateRef.current = serializedState;
        lastSavedRemoteStateRef.current = serializedState;
        setState(normalizedState);
        setHydrated(true);
      })
      .catch((error) => {
        console.error("Failed to load Supabase app state. Falling back to local state.", error);
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latestSerializedStateRef.current = JSON.stringify(state);
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || !canSyncRemoteState()) return;

    return subscribeRemoteState((remoteState) => {
      const normalizedState = normalizeAppState(remoteState);
      const serializedState = JSON.stringify(normalizedState);

      if (serializedState === latestSerializedStateRef.current) return;

      applyingRemoteStateRef.current = true;
      latestSerializedStateRef.current = serializedState;
      lastSavedRemoteStateRef.current = serializedState;
      setState(normalizedState);
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !canSyncRemoteState()) return;

    if (applyingRemoteStateRef.current) {
      applyingRemoteStateRef.current = false;
      return;
    }

    const serializedState = JSON.stringify(state);
    if (serializedState === lastSavedRemoteStateRef.current) return;

    const timeout = window.setTimeout(() => {
      lastSavedRemoteStateRef.current = serializedState;
      void saveRemoteState(state).catch((error) => {
        lastSavedRemoteStateRef.current = "";
        console.error("Failed to save Supabase app state.", error);
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const normalized = normalizeAppState(state);
    if (JSON.stringify(normalized) === JSON.stringify(state)) return;

    setState(normalized);
  }, [hydrated, state]);

  const reset = useCallback(() => {
    setState(seedData);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const addCategory: StoreContextValue["addCategory"] = useCallback((category) => {
    let result: StoreResult = { ok: true };

    setState((s) => {
      const name = normalizeCategoryName(category.name);
      if (!name) {
        result = { ok: false, error: "Category name is required" };
        return s;
      }

      if (s.categories.some((item) => sameCategoryName(item.name, name))) {
        result = { ok: false, error: "Category already exists" };
        return s;
      }

      return {
        ...s,
        categories: [...s.categories, { name, defaultUnit: category.defaultUnit }],
      };
    });

    return result;
  }, []);

  const updateCategory: StoreContextValue["updateCategory"] = useCallback(
    (currentName, category) => {
      let result: StoreResult = { ok: true };

      setState((s) => {
        const nextName = normalizeCategoryName(category.name);
        if (!nextName) {
          result = { ok: false, error: "Category name is required" };
          return s;
        }

        const current = s.categories.find((item) => sameCategoryName(item.name, currentName));
        if (!current) {
          result = { ok: false, error: "Category not found" };
          return s;
        }

        const hasConflict = s.categories.some(
          (item) =>
            !sameCategoryName(item.name, current.name) && sameCategoryName(item.name, nextName),
        );
        if (hasConflict) {
          result = { ok: false, error: "Another category already uses that name" };
          return s;
        }

        const categories = s.categories.map((item) =>
          sameCategoryName(item.name, current.name)
            ? { name: nextName, defaultUnit: category.defaultUnit }
            : item,
        );

        const products = s.products.map((product) =>
          sameCategoryName(product.category, current.name)
            ? { ...product, category: nextName }
            : product,
        );

        return { ...s, categories, products };
      });

      return result;
    },
    [],
  );

  const deleteCategory: StoreContextValue["deleteCategory"] = useCallback((name) => {
    const result: StoreResult = { ok: true };

    setState((s) => {
      const currentCategory = s.categories.find((category) =>
        sameCategoryName(category.name, name),
      );
      const hasProducts = s.products.some((product) => sameCategoryName(product.category, name));
      const filteredCategories = s.categories.filter(
        (category) => !sameCategoryName(category.name, name),
      );

      if (!hasProducts) {
        return {
          ...s,
          categories: filteredCategories,
        };
      }

      const fallbackCategoryExists = filteredCategories.some((category) =>
        sameCategoryName(category.name, FALLBACK_CATEGORY_NAME),
      );

      return {
        ...s,
        categories: fallbackCategoryExists
          ? filteredCategories
          : [
              ...filteredCategories,
              {
                name: FALLBACK_CATEGORY_NAME,
                defaultUnit: currentCategory?.defaultUnit ?? "បេ",
              },
            ],
        products: s.products.map((product) =>
          sameCategoryName(product.category, name)
            ? { ...product, category: FALLBACK_CATEGORY_NAME }
            : product,
        ),
      };
    });

    return result;
  }, []);

  const addMarket: StoreContextValue["addMarket"] = useCallback((name) => {
    let result: StoreResult = { ok: true };

    setState((s) => {
      const nextName = normalizeMarketName(name);
      if (!nextName) {
        result = { ok: false, error: "Market name is required" };
        return s;
      }

      if (s.markets.some((market) => sameMarketName(market, nextName))) {
        result = { ok: false, error: "Market already exists" };
        return s;
      }

      return { ...s, markets: [...s.markets, nextName] };
    });

    return result;
  }, []);

  const updateMarket: StoreContextValue["updateMarket"] = useCallback((currentName, nextName) => {
    let result: StoreResult = { ok: true };

    setState((s) => {
      const normalizedNextName = normalizeMarketName(nextName);
      if (!normalizedNextName) {
        result = { ok: false, error: "Market name is required" };
        return s;
      }

      const current = s.markets.find((market) => sameMarketName(market, currentName));
      if (!current) {
        result = { ok: false, error: "Market not found" };
        return s;
      }

      const hasConflict = s.markets.some(
        (market) => !sameMarketName(market, current) && sameMarketName(market, normalizedNextName),
      );
      if (hasConflict) {
        result = { ok: false, error: "Another market already uses that name" };
        return s;
      }

      return {
        ...s,
        markets: s.markets.map((market) =>
          sameMarketName(market, current) ? normalizedNextName : market,
        ),
        customers: s.customers.map((customer) =>
          sameMarketName(customer.market, current)
            ? { ...customer, market: normalizedNextName }
            : customer,
        ),
      };
    });

    return result;
  }, []);

  const deleteMarket: StoreContextValue["deleteMarket"] = useCallback((name) => {
    const result: StoreResult = { ok: true };

    setState((s) => {
      const currentMarket = s.markets.find((market) => sameMarketName(market, name));
      if (!currentMarket) return s;

      const hasCustomers = s.customers.some((customer) => sameMarketName(customer.market, name));
      const filteredMarkets = s.markets.filter((market) => !sameMarketName(market, name));

      if (!hasCustomers) return { ...s, markets: filteredMarkets };

      const fallbackMarketExists = filteredMarkets.some((market) =>
        sameMarketName(market, FALLBACK_MARKET_NAME),
      );

      return {
        ...s,
        markets: fallbackMarketExists
          ? filteredMarkets
          : [
              ...filteredMarkets,
              currentMarket === FALLBACK_MARKET_NAME ? currentMarket : FALLBACK_MARKET_NAME,
            ],
        customers: s.customers.map((customer) =>
          sameMarketName(customer.market, name)
            ? { ...customer, market: FALLBACK_MARKET_NAME }
            : customer,
        ),
      };
    });

    return result;
  }, []);

  const upsertProduct: StoreContextValue["upsertProduct"] = useCallback((p) => {
    setState((s) => {
      const categoryName = normalizeCategoryName(p.category);
      const matchedCategory = s.categories.find((item) =>
        sameCategoryName(item.name, categoryName),
      );
      const nextCategoryName = matchedCategory?.name ?? categoryName;
      const categories = matchedCategory
        ? s.categories
        : [...s.categories, { name: nextCategoryName, defaultUnit: primaryUnit(p.unit) }];
      const unit = normalizeProductUnits(p.unit);
      const saleSubUnits = normalizeProductSaleSubUnits({
        name: p.name,
        unit,
        saleSubUnits: p.saleSubUnits,
      });

      if (p.id) {
        return {
          ...s,
          categories,
          products: s.products.map((x) =>
            x.id === p.id
              ? {
                  ...x,
                  name: p.name,
                  category: nextCategoryName,
                  unit,
                  saleSubUnits: saleSubUnits.length > 0 ? saleSubUnits : undefined,
                  saleSubUnit: undefined,
                  minStock: p.minStock,
                  note: p.note,
                  variants: p.variants ?? x.variants,
                }
              : x,
          ),
        };
      }
      const newP: Product = {
        id: uid("p"),
        name: p.name,
        category: nextCategoryName,
        unit,
        stock: 0,
        avgCost: 0,
        totalCostBasis: 0,
        costLayers: [],
        saleSubUnits: saleSubUnits.length > 0 ? saleSubUnits : undefined,
        saleSubUnit: undefined,
        minStock: p.minStock,
        note: p.note,
        variants: p.variants ?? [],
      };
      return { ...s, categories, products: [...s.products, newP] };
    });
  }, []);

  const deleteProduct: StoreContextValue["deleteProduct"] = useCallback((id) => {
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
  }, []);

  const addVariant: StoreContextValue["addVariant"] = useCallback((productId, v) => {
    setState((s) => ({
      ...s,
      products: s.products.map((p) =>
        p.id === productId ? { ...p, variants: [...p.variants, { id: uid("v"), ...v }] } : p,
      ),
    }));
  }, []);

  const removeVariant: StoreContextValue["removeVariant"] = useCallback((productId, variantId) => {
    setState((s) => ({
      ...s,
      products: s.products.map((p) =>
        p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p,
      ),
    }));
  }, []);

  const upsertFactory: StoreContextValue["upsertFactory"] = useCallback((f) => {
    setState((s) => {
      if (f.id) {
        return {
          ...s,
          factories: s.factories.map((x) => (x.id === f.id ? { ...x, ...f, id: x.id } : x)),
        };
      }
      return { ...s, factories: [...s.factories, { ...f, id: uid("f") }] };
    });
  }, []);

  const deleteFactory: StoreContextValue["deleteFactory"] = useCallback((id) => {
    setState((s) => ({ ...s, factories: s.factories.filter((f) => f.id !== id) }));
  }, []);

  const upsertCustomer: StoreContextValue["upsertCustomer"] = useCallback((c) => {
    setState((s) => {
      const marketName = normalizeMarketName(c.market);
      const matchedMarket = s.markets.find((market) => sameMarketName(market, marketName));
      const nextMarketName = matchedMarket ?? marketName;
      const markets = matchedMarket
        ? s.markets
        : nextMarketName
          ? [...s.markets, nextMarketName]
          : s.markets;

      if (c.id) {
        return {
          ...s,
          markets,
          customers: s.customers.map((x) =>
            x.id === c.id ? { ...x, ...c, market: nextMarketName, id: x.id } : x,
          ),
        };
      }
      return {
        ...s,
        markets,
        customers: [...s.customers, { ...c, market: nextMarketName, id: uid("c") }],
      };
    });
  }, []);

  const deleteCustomer: StoreContextValue["deleteCustomer"] = useCallback((id) => {
    setState((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) }));
  }, []);

  const registerBuyer: StoreContextValue["registerBuyer"] = useCallback((data) => {
    let result: ReturnType<StoreContextValue["registerBuyer"]> = {
      ok: false,
      error: "Unknown error",
    };

    setState((s) => {
      const email = normalizeEmail(data.email);
      const name = data.name.trim();
      const phone = data.phone?.trim() || undefined;
      const marketName = normalizeMarketName(data.market);
      const location = data.location.trim();

      if (!email || !email.includes("@")) {
        result = { ok: false, error: "Enter a valid email address." };
        return s;
      }

      if (data.password.length < 6) {
        result = { ok: false, error: "Password must be at least 6 characters." };
        return s;
      }

      if (!name) {
        result = { ok: false, error: "Name is required." };
        return s;
      }

      if (!marketName) {
        result = { ok: false, error: "Market is required." };
        return s;
      }

      if (!location) {
        result = { ok: false, error: "Location is required." };
        return s;
      }

      if (s.buyerAccounts.some((buyer) => buyer.email === email)) {
        result = { ok: false, error: "This email already has a buyer account." };
        return s;
      }

      const matchedMarket = s.markets.find((market) => sameMarketName(market, marketName));
      const nextMarketName = matchedMarket ?? marketName;
      const customerId = uid("c");
      const buyer: BuyerAccount = {
        id: uid("buyer"),
        email,
        passwordDigest: getBuyerPasswordDigest(data.password),
        name,
        phone,
        market: nextMarketName,
        location,
        customerId,
        createdAt: todayIsoString(),
      };
      const customer: Customer = {
        id: customerId,
        name,
        phone: phone ?? "",
        market: nextMarketName,
        type: "Buyer App",
        notes: `Buyer account: ${email}. Location: ${location}`,
      };

      result = { ok: true, buyer };

      return {
        ...s,
        markets: matchedMarket ? s.markets : [...s.markets, nextMarketName],
        customers: [...s.customers, customer],
        buyerAccounts: [...s.buyerAccounts, buyer],
        buyerSessionId: buyer.id,
      };
    });

    return result;
  }, []);

  const signInBuyer: StoreContextValue["signInBuyer"] = useCallback((email, password) => {
    let result: StoreResult = { ok: false, error: "Invalid email or password." };

    setState((s) => {
      const buyer = s.buyerAccounts.find((account) => account.email === normalizeEmail(email));

      if (!buyer || buyer.passwordDigest !== getBuyerPasswordDigest(password)) {
        result = { ok: false, error: "Invalid email or password." };
        return s;
      }

      result = { ok: true };
      return { ...s, buyerSessionId: buyer.id };
    });

    return result;
  }, []);

  const signInBuyerByEmail: StoreContextValue["signInBuyerByEmail"] = useCallback((email, name) => {
    let result: StoreResult = { ok: false, error: "Enter a valid email address." };

    setState((s) => {
      const normalizedEmail = normalizeEmail(email);
      const displayName = name?.trim() || nameFromEmail(normalizedEmail);

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        result = { ok: false, error: "Enter a valid email address." };
        return s;
      }

      const buyer = s.buyerAccounts.find((account) => account.email === normalizedEmail);

      if (buyer) {
        result = { ok: true };
        if (buyer.name === displayName) {
          return { ...s, buyerSessionId: buyer.id };
        }

        return {
          ...s,
          buyerAccounts: s.buyerAccounts.map((account) =>
            account.id === buyer.id ? { ...account, name: displayName } : account,
          ),
          customers: s.customers.map((customer) =>
            customer.id === buyer.customerId ? { ...customer, name: displayName } : customer,
          ),
          buyerSessionId: buyer.id,
        };
      }

      const customerId = uid("c");
      const now = todayIsoString();
      const newBuyer: BuyerAccount = {
        id: uid("buyer"),
        email: normalizedEmail,
        passwordDigest: getBuyerPasswordDigest(`supabase-auth-${normalizedEmail}`),
        name: displayName,
        market: "",
        location: "",
        customerId,
        createdAt: now,
      };
      const customer: Customer = {
        id: customerId,
        name: displayName,
        phone: "",
        market: "",
        type: "Buyer App",
        notes: `Supabase customer account: ${normalizedEmail}`,
      };

      result = { ok: true };
      return {
        ...s,
        customers: [...s.customers, customer],
        buyerAccounts: [...s.buyerAccounts, newBuyer],
        buyerSessionId: newBuyer.id,
      };
    });

    return result;
  }, []);

  const signOutBuyer: StoreContextValue["signOutBuyer"] = useCallback(() => {
    setState((s) => ({ ...s, buyerSessionId: undefined }));
  }, []);

  const updateBuyerProfile: StoreContextValue["updateBuyerProfile"] = useCallback((data) => {
    let result: StoreResult = { ok: false, error: "Unknown error" };

    setState((s) => {
      const buyer = s.buyerAccounts.find((account) => account.id === s.buyerSessionId);
      if (!buyer) {
        result = { ok: false, error: "Please sign in again." };
        return s;
      }

      const name = data.name.trim();
      const phone = data.phone?.trim() || undefined;
      const telegram = data.telegram?.trim() ? normalizeTelegramValue(data.telegram) : undefined;
      const location = data.location?.trim() ?? "";
      const marketName = normalizeMarketName(data.market);

      if (!name) {
        result = { ok: false, error: "Name is required." };
        return s;
      }

      if (!marketName) {
        result = { ok: false, error: "Choose your market before ordering." };
        return s;
      }

      const matchedMarket = s.markets.find((market) => sameMarketName(market, marketName));
      if (!matchedMarket) {
        result = { ok: false, error: "Choose a market from the seller list." };
        return s;
      }

      if (telegram && !getTelegramUrl(telegram)) {
        result = { ok: false, error: "Enter a valid Telegram username or link." };
        return s;
      }

      result = { ok: true };
      return {
        ...s,
        buyerAccounts: s.buyerAccounts.map((account) =>
          account.id === buyer.id
            ? {
                ...account,
                name,
                phone,
                telegram,
                market: matchedMarket,
                location,
              }
            : account,
        ),
        customers: s.customers.map((customer) =>
          customer.id === buyer.customerId
            ? {
                ...customer,
                name,
                phone: phone ?? "",
                telegram,
                market: matchedMarket,
                notes: location
                  ? `Supabase customer account: ${buyer.email}. Location: ${location}`
                  : customer.notes,
              }
            : customer,
        ),
      };
    });

    return result;
  }, []);

  const addBuyerOrder: StoreContextValue["addBuyerOrder"] = useCallback((data) => {
    let result: BuyerOrder | { error: string } = { error: "Unknown error" };

    setState((s) => {
      const buyer = s.buyerAccounts.find((account) => account.id === data.buyerId);
      if (!buyer) {
        result = { error: "Please sign in again." };
        return s;
      }

      if (!normalizeMarketName(buyer.market)) {
        result = { error: "Choose your market in Settings before ordering." };
        return s;
      }

      if (data.items.length === 0) {
        result = { error: "Add at least one product." };
        return s;
      }

      const orderItems: BuyerOrder["items"] = [];
      let totalEstimate = 0;

      for (const item of data.items) {
        const product = s.products.find((candidate) => candidate.id === item.productId);
        if (!product) {
          result = { error: "Product not found." };
          return s;
        }

        const unit = normalizeSaleUnit(product, item.unit);
        const quantity = Number(Math.max(item.quantity, 0));
        if (quantity <= 0) {
          result = { error: `Quantity must be greater than zero for ${product.name}.` };
          return s;
        }

        if (
          shouldLimitSaleSubUnitToSingleStockUnit(product, unit) &&
          quantity >= getSaleUnitQuantityPerStockUnit(product, unit)
        ) {
          result = {
            error: `Package orders for ${product.name} must stay below 1 ${formatUnits(product.unit)}.`,
          };
          return s;
        }

        const stockQuantity = convertSaleQuantityToStockQuantity(product, quantity, unit);
        if (stockQuantity > product.stock) {
          result = { error: `Not enough stock for ${product.name}.` };
          return s;
        }

        const visiblePrice = findBuyerVisiblePrice(s, buyer.customerId, product.id, unit);
        const estimatedUnitPrice = visiblePrice?.price;
        if (estimatedUnitPrice !== undefined) {
          totalEstimate += quantity * estimatedUnitPrice;
        }

        orderItems.push({
          productId: product.id,
          quantity,
          unit,
          stockQuantity,
          estimatedUnitPrice,
        });
      }

      const now = todayIsoString();
      const order: BuyerOrder = {
        id: uid("bo"),
        orderNumber: `O-${3000 + s.buyerOrders.length + 1}`,
        buyerId: buyer.id,
        customerId: buyer.customerId,
        date: now,
        updatedAt: now,
        status: "pending",
        paymentStatus: "unpaid",
        paidAmount: 0,
        items: orderItems,
        totalEstimate: Number(totalEstimate.toFixed(2)),
        notes: data.notes?.trim() || undefined,
      };

      result = order;
      return { ...s, buyerOrders: [order, ...s.buyerOrders] };
    });

    return result;
  }, []);

  const updateBuyerOrderStatus: StoreContextValue["updateBuyerOrderStatus"] = useCallback(
    (orderId, status, sellerNote) => {
      setState((s) => ({
        ...s,
        buyerOrders: s.buyerOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                sellerNote: sellerNote?.trim() || order.sellerNote,
                updatedAt: todayIsoString(),
              }
            : order,
        ),
      }));
    },
    [],
  );

  const updateBuyerOrderPayment: StoreContextValue["updateBuyerOrderPayment"] = useCallback(
    (orderId, paymentStatus, paidAmount) => {
      setState((s) => ({
        ...s,
        buyerOrders: s.buyerOrders.map((order) => {
          if (order.id !== orderId) return order;

          const total = Number(Math.max(order.totalEstimate, 0).toFixed(2));
          const nextPaid =
            paymentStatus === "paid"
              ? total
              : paymentStatus === "unpaid"
                ? 0
                : Math.min(Math.max(paidAmount ?? order.paidAmount ?? 0, 0), total);
          const nextPaymentStatus =
            nextPaid <= 0 ? "unpaid" : nextPaid >= total ? "paid" : paymentStatus;

          return {
            ...order,
            paymentStatus: nextPaymentStatus,
            paidAmount: Number(nextPaid.toFixed(2)),
            updatedAt: todayIsoString(),
          };
        }),
      }));
    },
    [],
  );

  const setCustomerProductPrices: StoreContextValue["setCustomerProductPrices"] = useCallback(
    (customerId, entries) => {
      if (!customerId) return;

      setState((s) => {
        const normalizedEntries = entries
          .map((entry) => {
            if (!entry.productId) return null;
            if (entry.price === null) {
              return { productId: entry.productId, price: null as number | null };
            }

            if (!Number.isFinite(entry.price)) return null;
            return {
              productId: entry.productId,
              price: Number(Math.max(entry.price, 0).toFixed(2)),
            };
          })
          .filter((entry): entry is { productId: string; price: number | null } => entry !== null);

        if (normalizedEntries.length === 0) return s;

        const updatedProductIds = new Set(normalizedEntries.map((entry) => entry.productId));
        const customerPrices = s.customerPrices.filter(
          (customerPrice) =>
            !(
              customerPrice.customerId === customerId &&
              updatedProductIds.has(customerPrice.productId)
            ),
        );

        normalizedEntries.forEach((entry) => {
          if (entry.price === null || entry.price <= 0) return;

          customerPrices.push({
            customerId,
            productId: entry.productId,
            unit: undefined,
            price: entry.price,
          });
        });

        return {
          ...s,
          customerPrices,
        };
      });
    },
    [],
  );

  const addStockIn: StoreContextValue["addStockIn"] = useCallback((data) => {
    let created!: StockInInvoice;
    setState((s) => {
      const total = data.items.reduce((acc, it) => acc + it.quantity * it.buyPrice, 0);
      const invoice: StockInInvoice = { id: uid("si"), total, ...data };
      const products = s.products.map((p) => {
        const matching = data.items.filter((it: StockInItem) => it.productId === p.id);
        if (matching.length === 0) return p;
        let layers = fallbackProductLayers(p);
        for (const it of matching) {
          layers = addStockToLayers(layers, it.quantity, it.buyPrice);
        }
        return applyLayersToProduct(p, layers);
      });
      created = invoice;
      return { ...s, stockIns: [invoice, ...s.stockIns], products };
    });
    return created;
  }, []);

  const updateStockIn: StoreContextValue["updateStockIn"] = useCallback((invoiceId, data) => {
    let result: StoreResult = { ok: true };

    setState((s) => {
      const existingInvoice = s.stockIns.find((invoice) => invoice.id === invoiceId);
      if (!existingInvoice) {
        result = { ok: false, error: "Stock-in invoice not found" };
        return s;
      }

      const total = data.items.reduce((sum, item) => sum + item.quantity * item.buyPrice, 0);
      const nextStockIns = s.stockIns.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, ...data, total } : invoice,
      );
      const recalculated = buildOpeningInventoryLayers(s.products, nextStockIns, s.sales);

      if (!recalculated.ok) {
        result = { ok: false, error: recalculated.error };
        return s;
      }

      return {
        ...s,
        stockIns: nextStockIns,
        products: recalculated.products,
        sales: recalculated.sales,
      };
    });

    return result;
  }, []);

  const addSale: StoreContextValue["addSale"] = useCallback((data) => {
    let result: Sale | { error: string } = { error: "Unknown error" };
    setState((s) => {
      const requestedByProduct = new Map<string, number>();

      for (const it of data.items) {
        const product = s.products.find((x) => x.id === it.productId);
        if (!product) {
          result = { error: `Product not found` };
          return s;
        }
        if (
          shouldLimitSaleSubUnitToSingleStockUnit(product, it.unit) &&
          it.quantity >= getSaleUnitQuantityPerStockUnit(product, it.unit)
        ) {
          result = {
            error: `Package sales for ${product.name} must stay below 1 ${formatUnits(product.unit)}.`,
          };
          return s;
        }
        requestedByProduct.set(
          it.productId,
          (requestedByProduct.get(it.productId) ?? 0) +
            convertSaleQuantityToStockQuantity(product, it.quantity, it.unit),
        );
      }

      // check stock
      for (const it of data.items) {
        const p = s.products.find((x) => x.id === it.productId);
        if (!p) {
          result = { error: `Product not found` };
          return s;
        }
        const requested = requestedByProduct.get(it.productId) ?? 0;
        if (requested > p.stock) {
          result = { error: `Not enough stock for ${p.name} (have ${p.stock})` };
          return s;
        }
      }

      const simulation = simulateDraftSale(s.products, data.items);
      if (!simulation.ok) {
        result = { error: simulation.error };
        return s;
      }

      const paidAmount = Number(
        Math.min(Math.max(data.paidAmount, 0), simulation.total).toFixed(2),
      );
      const paymentStatus =
        paidAmount <= 0 ? "unpaid" : paidAmount >= simulation.total ? "paid" : "partial";
      const receiptNumber = `R-${2000 + s.sales.length + 1}`;
      const sale: Sale = {
        id: uid("s"),
        receiptNumber,
        customerId: data.customerId,
        date: data.date,
        items: simulation.items,
        total: simulation.total,
        estimatedProfit: simulation.estimatedProfit,
        paidAmount,
        paymentStatus,
        telegramStatus: "not_sent",
        notes: data.notes,
      };

      // remember customer-specific prices (latest wins)
      const customerPrices = [...s.customerPrices];
      for (const it of simulation.items) {
        const idx = customerPrices.findIndex(
          (cp) =>
            cp.customerId === data.customerId &&
            cp.productId === it.productId &&
            cp.unit === it.unit,
        );
        const entry: CustomerPrice = {
          customerId: data.customerId,
          productId: it.productId,
          unit: it.unit,
          price: it.unitPrice,
        };
        if (idx >= 0) customerPrices[idx] = entry;
        else customerPrices.push(entry);
      }

      const payments = [...s.payments];
      if (paidAmount > 0) {
        payments.push({
          id: uid("pay"),
          customerId: data.customerId,
          saleId: sale.id,
          amount: paidAmount,
          date: data.date,
        });
      }

      result = sale;
      return {
        ...s,
        sales: [sale, ...s.sales],
        products: simulation.products,
        customerPrices,
        payments,
      };
    });
    return result;
  }, []);

  const updateSale: StoreContextValue["updateSale"] = useCallback((saleId, data) => {
    let result: Sale | { error: string } = { error: "Unknown error" };

    setState((s) => {
      const existingSale = s.sales.find((sale) => sale.id === saleId);
      if (!existingSale) {
        result = { error: "Sale not found" };
        return s;
      }

      if (data.items.length === 0) {
        result = { error: "Add at least one item" };
        return s;
      }

      for (const item of data.items) {
        const product = s.products.find((x) => x.id === item.productId);
        if (!product) {
          result = { error: "Product not found" };
          return s;
        }
        if (item.quantity <= 0) {
          result = { error: `Quantity must be greater than zero for ${product.name}` };
          return s;
        }
        if (item.unitPrice < 0) {
          result = { error: `Price cannot be negative for ${product.name}` };
          return s;
        }
        if (
          shouldLimitSaleSubUnitToSingleStockUnit(product, item.unit) &&
          item.quantity >= getSaleUnitQuantityPerStockUnit(product, item.unit)
        ) {
          result = {
            error: `Package sales for ${product.name} must stay below 1 ${formatUnits(product.unit)}.`,
          };
          return s;
        }
      }

      const nextSales = s.sales.map((sale) => {
        if (sale.id !== saleId) return sale;

        return {
          ...sale,
          customerId: data.customerId,
          date: data.date,
          items: data.items.map((item) => {
            const product = s.products.find((x) => x.id === item.productId);
            const unit = product ? normalizeSaleUnit(product, item.unit) : item.unit;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unit,
              stockQuantity: 0,
              unitPrice: item.unitPrice,
              avgCostAtSale: 0,
            };
          }),
          paidAmount: Number(Math.max(data.paidAmount, 0).toFixed(2)),
          paymentStatus: data.paymentStatus,
          notes: data.notes,
          telegramStatus: "not_sent",
        };
      });

      const recalculated = buildOpeningInventoryLayers(s.products, s.stockIns, nextSales);
      if (!recalculated.ok) {
        result = { error: recalculated.error };
        return s;
      }

      const updatedSale = recalculated.sales.find((sale) => sale.id === saleId);
      if (!updatedSale) {
        result = { error: "Updated sale not found" };
        return s;
      }

      const customerPrices = [...s.customerPrices];
      for (const item of updatedSale.items) {
        const idx = customerPrices.findIndex(
          (cp) =>
            cp.customerId === updatedSale.customerId &&
            cp.productId === item.productId &&
            cp.unit === item.unit,
        );
        const entry: CustomerPrice = {
          customerId: updatedSale.customerId,
          productId: item.productId,
          unit: item.unit,
          price: item.unitPrice,
        };
        if (idx >= 0) customerPrices[idx] = entry;
        else customerPrices.push(entry);
      }

      result = updatedSale;
      return {
        ...s,
        sales: recalculated.sales,
        products: recalculated.products,
        customerPrices,
      };
    });

    return result;
  }, []);

  const updateSaleTelegram: StoreContextValue["updateSaleTelegram"] = useCallback(
    (saleId, status) => {
      setState((s) => ({
        ...s,
        sales: s.sales.map((x) => (x.id === saleId ? { ...x, telegramStatus: status } : x)),
      }));
    },
    [],
  );

  const updateSaleArchive: StoreContextValue["updateSaleArchive"] = useCallback(
    (saleId, archived) => {
      setState((s) => ({
        ...s,
        sales: s.sales.map((sale) =>
          sale.id === saleId
            ? { ...sale, archivedAt: archived ? (sale.archivedAt ?? todayIsoString()) : undefined }
            : sale,
        ),
      }));
    },
    [],
  );

  const recordPayment: StoreContextValue["recordPayment"] = useCallback((p) => {
    setState((s) => {
      const payments = [...s.payments, { ...p, id: uid("pay") }];
      let sales = s.sales;
      if (p.saleId) {
        sales = s.sales.map((sale) => {
          if (sale.id !== p.saleId) return sale;
          const newPaid = sale.paidAmount + p.amount;
          const status: Sale["paymentStatus"] =
            newPaid >= sale.total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
          return { ...sale, paidAmount: Math.min(newPaid, sale.total), paymentStatus: status };
        });
      }
      return { ...s, payments, sales };
    });
  }, []);

  const setShopName = useCallback((name: string) => {
    setState((s) => ({ ...s, shopName: name }));
  }, []);

  const setShopContact: StoreContextValue["setShopContact"] = useCallback((contact) => {
    const email = contact.email?.trim() ?? "";
    const telegram = contact.telegram?.trim()
      ? normalizeTelegramValue(contact.telegram)
      : undefined;

    if (email && !email.includes("@")) {
      return { ok: false, error: "Enter a valid seller email address." };
    }

    if (telegram && !getTelegramUrl(telegram)) {
      return { ok: false, error: "Enter a valid Telegram username or link." };
    }

    setState((s) => ({
      ...s,
      shopEmail: email || undefined,
      shopTelegram: telegram,
    }));

    return { ok: true };
  }, []);

  const currentBuyer = useMemo(
    () => state.buyerAccounts.find((buyer) => buyer.id === state.buyerSessionId) ?? null,
    [state.buyerAccounts, state.buyerSessionId],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      currentBuyer,
      reset,
      addCategory,
      updateCategory,
      deleteCategory,
      addMarket,
      updateMarket,
      deleteMarket,
      upsertProduct,
      deleteProduct,
      addVariant,
      removeVariant,
      upsertFactory,
      deleteFactory,
      upsertCustomer,
      deleteCustomer,
      registerBuyer,
      signInBuyer,
      signInBuyerByEmail,
      signOutBuyer,
      updateBuyerProfile,
      addBuyerOrder,
      updateBuyerOrderStatus,
      updateBuyerOrderPayment,
      setCustomerProductPrices,
      addStockIn,
      updateStockIn,
      addSale,
      updateSale,
      updateSaleTelegram,
      updateSaleArchive,
      recordPayment,
      setShopName,
      setShopContact,
    }),
    [
      state,
      currentBuyer,
      reset,
      addCategory,
      updateCategory,
      deleteCategory,
      addMarket,
      updateMarket,
      deleteMarket,
      upsertProduct,
      deleteProduct,
      addVariant,
      removeVariant,
      upsertFactory,
      deleteFactory,
      upsertCustomer,
      deleteCustomer,
      registerBuyer,
      signInBuyer,
      signInBuyerByEmail,
      signOutBuyer,
      updateBuyerProfile,
      addBuyerOrder,
      updateBuyerOrderStatus,
      updateBuyerOrderPayment,
      setCustomerProductPrices,
      addStockIn,
      updateStockIn,
      addSale,
      updateSale,
      updateSaleTelegram,
      updateSaleArchive,
      recordPayment,
      setShopName,
      setShopContact,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

// Selectors / helpers
export function customerDebt(state: AppState, customerId: string) {
  return state.sales
    .filter((s) => s.customerId === customerId)
    .reduce((acc, s) => acc + (s.total - s.paidAmount), 0);
}

export function customerTotals(state: AppState, customerId: string) {
  const sales = state.sales.filter((s) => s.customerId === customerId);
  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalProfit = sales.reduce((a, s) => a + s.estimatedProfit, 0);
  const debt = sales.reduce((a, s) => a + (s.total - s.paidAmount), 0);
  return { totalSales, totalProfit, debt, count: sales.length };
}

export function suggestedPrice(
  state: AppState,
  customerId: string,
  productId: string,
  unit?: SaleItem["unit"],
): number | undefined {
  return findSuggestedPrice(state, customerId, productId, unit);
}

export function buyerVisiblePrice(
  state: AppState,
  customerId: string,
  productId: string,
  unit?: SaleItem["unit"],
): BuyerVisiblePrice | undefined {
  return findBuyerVisiblePrice(state, customerId, productId, unit);
}

export function fmtMoney(n: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

export { formatUnits };
