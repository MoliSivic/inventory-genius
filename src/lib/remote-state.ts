import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  getSupabaseUserProfile,
  isSupabaseDataSyncReady,
  type AppRole,
} from "./supabase";
import type {
  AppState,
  BuyerAccount,
  BuyerOrder,
  BuyerOrderItem,
  BuyerOrderStatus,
  Customer,
  CustomerPrice,
  Factory,
  Payment,
  PaymentStatus,
  Product,
  ProductCostLayer,
  ProductSaleSubUnit,
  ProductVariant,
  Sale,
  SaleItem,
  TelegramStatus,
  UnitType,
} from "./types";

type SupabaseClient = ReturnType<typeof getSupabaseClient>;
type MutationRow = Record<string, unknown>;

type AuthContext = {
  role: AppRole;
  user: User;
};

type AppSettingsRow = {
  id: string;
  shop_name: string | null;
  shop_email: string | null;
  shop_telegram: string | null;
};

type CategoryRow = {
  name: string;
  default_unit: string;
};

type MarketRow = {
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  units: string[] | null;
  stock: number | string | null;
  avg_cost: number | string | null;
  total_cost_basis: number | string | null;
  cost_layers: unknown;
  sale_sub_units: unknown;
  min_stock: number | string | null;
  note: string | null;
};

type ProductVariantRow = {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  type: string | null;
};

type FactoryRow = {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
};

type CustomerRow = {
  id: string;
  auth_user_id: string | null;
  name: string;
  phone: string | null;
  market: string | null;
  telegram: string | null;
  type: string | null;
  notes: string | null;
};

type BuyerAccountRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  password_digest: string | null;
  name: string;
  phone: string | null;
  telegram: string | null;
  market: string | null;
  location: string | null;
  customer_id: string;
  created_at: string | null;
};

type StockInInvoiceRow = {
  id: string;
  invoice_number: string;
  factory_id: string;
  date: string;
  total: number | string | null;
  photo: string | null;
  notes: string | null;
};

type StockInItemRow = {
  invoice_id: string;
  line_no: number;
  product_id: string;
  quantity: number | string | null;
  buy_price: number | string | null;
};

type SaleRow = {
  id: string;
  receipt_number: string;
  customer_id: string;
  date: string;
  archived_at: string | null;
  total: number | string | null;
  estimated_profit: number | string | null;
  paid_amount: number | string | null;
  payment_status: string | null;
  telegram_status: string | null;
  notes: string | null;
};

type SaleItemRow = {
  sale_id: string;
  line_no: number;
  product_id: string;
  quantity: number | string | null;
  unit: string | null;
  stock_quantity: number | string | null;
  unit_price: number | string | null;
  avg_cost_at_sale: number | string | null;
};

type BuyerOrderRow = {
  id: string;
  order_number: string;
  buyer_id: string;
  customer_id: string;
  date: string;
  updated_at_text: string;
  status: string | null;
  payment_status: string | null;
  paid_amount: number | string | null;
  total_estimate: number | string | null;
  notes: string | null;
  seller_note: string | null;
  sale_id: string | null;
};

type BuyerOrderItemRow = {
  order_id: string;
  line_no: number;
  product_id: string;
  quantity: number | string | null;
  unit: string | null;
  stock_quantity: number | string | null;
  estimated_unit_price: number | string | null;
};

type PaymentRow = {
  id: string;
  customer_id: string;
  sale_id: string | null;
  amount: number | string | null;
  date: string;
  note: string | null;
};

type CustomerPriceRow = {
  customer_id: string;
  product_id: string;
  unit: string | null;
  price: number | string | null;
};

const UNIT_VALUES = new Set<UnitType>(["បេ", "កេស", "ឈុត", "យួ", "ដុំ", "kg", "កញ្ចប់"]);
const BUYER_ORDER_STATUSES = new Set<BuyerOrderStatus>([
  "pending",
  "confirmed",
  "packing",
  "completed",
  "cancelled",
]);
const PAYMENT_STATUSES = new Set<PaymentStatus>(["paid", "unpaid", "partial"]);
const TELEGRAM_STATUSES = new Set<TelegramStatus>([
  "not_sent",
  "customer",
  "owner",
  "both",
  "failed",
]);
const LIVE_TABLES = [
  "app_settings",
  "categories",
  "markets",
  "products",
  "product_variants",
  "factories",
  "customers",
  "buyer_accounts",
  "stock_in_invoices",
  "stock_in_items",
  "buyer_orders",
  "buyer_order_items",
  "sales",
  "sale_items",
  "payments",
  "customer_prices",
];

let latestFallbackState: AppState | null = null;
let customerAuthUserById = new Map<string, string | null>();
let buyerAuthUserById = new Map<string, string | null>();

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toUnit(value: string | null | undefined): UnitType | undefined {
  return UNIT_VALUES.has(value as UnitType) ? (value as UnitType) : undefined;
}

function toUnitArray(values: string[] | null | undefined) {
  const units = (values ?? [])
    .map((value) => toUnit(value))
    .filter((unit): unit is UnitType => Boolean(unit));
  return units.length > 0 ? units : (["បេ"] satisfies UnitType[]);
}

function toBuyerOrderStatus(value: string | null | undefined): BuyerOrderStatus {
  return BUYER_ORDER_STATUSES.has(value as BuyerOrderStatus)
    ? (value as BuyerOrderStatus)
    : "pending";
}

function toPaymentStatus(value: string | null | undefined): PaymentStatus {
  return PAYMENT_STATUSES.has(value as PaymentStatus) ? (value as PaymentStatus) : "unpaid";
}

function toTelegramStatus(value: string | null | undefined): TelegramStatus {
  return TELEGRAM_STATUSES.has(value as TelegramStatus) ? (value as TelegramStatus) : "not_sent";
}

function parseCostLayers(value: unknown): ProductCostLayer[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const quantity = toNumber(row.quantity as number | string | null | undefined);
      const unitCost = toNumber(row.unitCost as number | string | null | undefined);
      if (quantity <= 0 || unitCost < 0) return null;
      return { quantity, unitCost };
    })
    .filter((item): item is ProductCostLayer => item !== null);
}

function parseSaleSubUnits(value: unknown): ProductSaleSubUnit[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const saleSubUnits = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const unit = toUnit(row.unit as string | null | undefined);
      const quantityPerStockUnit = toNumber(
        row.quantityPerStockUnit as number | string | null | undefined,
      );
      if (!unit || quantityPerStockUnit <= 0) return null;
      return { unit, quantityPerStockUnit };
    })
    .filter((item): item is ProductSaleSubUnit => item !== null);

  return saleSubUnits.length > 0 ? saleSubUnits : undefined;
}

function sortByLineNo<T extends { line_no: number }>(rows: T[]) {
  return [...rows].sort((left, right) => left.line_no - right.line_no);
}

function groupRows<T, K extends string>(rows: T[], getKey: (row: T) => K) {
  const grouped = new Map<K, T[]>();

  rows.forEach((row) => {
    const key = getKey(row);
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  });

  return grouped;
}

async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseDataSyncReady) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const profile = await getSupabaseUserProfile(data.user);
  return {
    user: data.user,
    role: profile.role,
  };
}

async function selectRows<T>(supabase: SupabaseClient, table: string, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function selectSingle<T>(supabase: SupabaseClient, table: string, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns).maybeSingle();
  if (error) throw error;
  return (data ?? null) as T | null;
}

async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: MutationRow[],
  onConflict?: string,
) {
  if (rows.length === 0) return;

  const query = onConflict
    ? supabase.from(table).upsert(rows, { onConflict })
    : supabase.from(table).upsert(rows);
  const { error } = await query;
  if (error) throw error;
}

async function clearRows(supabase: SupabaseClient, table: string, column: string, value: unknown) {
  const { error } = await supabase.from(table).delete().neq(column, value);
  if (error) throw error;
}

function stockInItemRows(stockIns: AppState["stockIns"]): MutationRow[] {
  return stockIns.flatMap((invoice) =>
    invoice.items.map((item, index) => ({
      invoice_id: invoice.id,
      line_no: index + 1,
      product_id: item.productId,
      quantity: item.quantity,
      buy_price: item.buyPrice,
    })),
  );
}

function saleItemRows(sales: Sale[]): MutationRow[] {
  return sales.flatMap((sale) =>
    sale.items.map((item, index) => ({
      sale_id: sale.id,
      line_no: index + 1,
      product_id: item.productId,
      quantity: item.quantity,
      unit: item.unit ?? null,
      stock_quantity: item.stockQuantity ?? null,
      unit_price: item.unitPrice,
      avg_cost_at_sale: item.avgCostAtSale,
    })),
  );
}

function buyerOrderItemRows(orders: BuyerOrder[]): MutationRow[] {
  return orders.flatMap((order) =>
    order.items.map((item, index) => ({
      order_id: order.id,
      line_no: index + 1,
      product_id: item.productId,
      quantity: item.quantity,
      unit: item.unit ?? null,
      stock_quantity: item.stockQuantity,
      estimated_unit_price: item.estimatedUnitPrice ?? null,
    })),
  );
}

function customerPriceRows(prices: CustomerPrice[]): MutationRow[] {
  return prices.map((price) => ({
    customer_id: price.customerId,
    product_id: price.productId,
    unit: price.unit ?? "",
    price: price.price,
  }));
}

function productRows(products: Product[]): MutationRow[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    units: product.unit,
    stock: product.stock,
    avg_cost: product.avgCost,
    total_cost_basis: product.totalCostBasis,
    cost_layers: product.costLayers,
    sale_sub_units: product.saleSubUnits ?? null,
    min_stock: product.minStock,
    note: product.note ?? null,
  }));
}

function productVariantRows(products: Product[]): MutationRow[] {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      product_id: product.id,
      size: variant.size ?? null,
      color: variant.color ?? null,
      type: variant.type ?? null,
    })),
  );
}

function factoryRows(factories: Factory[]): MutationRow[] {
  return factories.map((factory) => ({
    id: factory.id,
    name: factory.name,
    phone: factory.phone,
    location: factory.location,
    notes: factory.notes ?? null,
  }));
}

function customerRows(customers: Customer[]): MutationRow[] {
  return customers.map((customer) => ({
    id: customer.id,
    auth_user_id: customerAuthUserById.get(customer.id) ?? null,
    name: customer.name,
    phone: customer.phone,
    market: customer.market,
    telegram: customer.telegram ?? null,
    type: customer.type,
    notes: customer.notes ?? null,
  }));
}

function buyerAccountRows(accounts: BuyerAccount[]): MutationRow[] {
  return accounts.map((account) => ({
    id: account.id,
    auth_user_id: buyerAuthUserById.get(account.id) ?? null,
    email: account.email,
    password_digest: account.passwordDigest,
    name: account.name,
    phone: account.phone ?? null,
    telegram: account.telegram ?? null,
    market: account.market,
    location: account.location,
    customer_id: account.customerId,
    created_at: account.createdAt,
  }));
}

function stockInRows(stockIns: AppState["stockIns"]): MutationRow[] {
  return stockIns.map((invoice) => ({
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    factory_id: invoice.factoryId,
    date: invoice.date,
    total: invoice.total,
    photo: invoice.photo ?? null,
    notes: invoice.notes ?? null,
  }));
}

function saleRows(sales: Sale[]): MutationRow[] {
  return sales.map((sale) => ({
    id: sale.id,
    receipt_number: sale.receiptNumber,
    customer_id: sale.customerId,
    date: sale.date,
    archived_at: sale.archivedAt ?? null,
    total: sale.total,
    estimated_profit: sale.estimatedProfit,
    paid_amount: sale.paidAmount,
    payment_status: sale.paymentStatus,
    telegram_status: sale.telegramStatus,
    notes: sale.notes ?? null,
  }));
}

function buyerOrderRows(orders: BuyerOrder[]): MutationRow[] {
  return orders.map((order) => ({
    id: order.id,
    order_number: order.orderNumber,
    buyer_id: order.buyerId,
    customer_id: order.customerId,
    date: order.date,
    updated_at_text: order.updatedAt,
    status: order.status,
    payment_status: order.paymentStatus,
    paid_amount: order.paidAmount,
    total_estimate: order.totalEstimate,
    notes: order.notes ?? null,
    seller_note: order.sellerNote ?? null,
    sale_id: order.saleId ?? null,
  }));
}

function paymentRows(payments: Payment[]): MutationRow[] {
  return payments.map((payment) => ({
    id: payment.id,
    customer_id: payment.customerId,
    sale_id: payment.saleId ?? null,
    amount: payment.amount,
    date: payment.date,
    note: payment.note ?? null,
  }));
}

function mapLoadedState(
  fallbackState: AppState,
  rows: {
    appSettings: AppSettingsRow | null;
    categories: CategoryRow[];
    markets: MarketRow[];
    products: ProductRow[];
    productVariants: ProductVariantRow[];
    factories: FactoryRow[];
    customers: CustomerRow[];
    buyerAccounts: BuyerAccountRow[];
    stockIns: StockInInvoiceRow[];
    stockInItems: StockInItemRow[];
    sales: SaleRow[];
    saleItems: SaleItemRow[];
    buyerOrders: BuyerOrderRow[];
    buyerOrderItems: BuyerOrderItemRow[];
    payments: PaymentRow[];
    customerPrices: CustomerPriceRow[];
  },
): AppState {
  customerAuthUserById = new Map(
    rows.customers.map((customer) => [customer.id, customer.auth_user_id]),
  );
  buyerAuthUserById = new Map(rows.buyerAccounts.map((buyer) => [buyer.id, buyer.auth_user_id]));

  const variantsByProduct = groupRows(rows.productVariants, (variant) => variant.product_id);
  const stockItemsByInvoice = groupRows(rows.stockInItems, (item) => item.invoice_id);
  const saleItemsBySale = groupRows(rows.saleItems, (item) => item.sale_id);
  const orderItemsByOrder = groupRows(rows.buyerOrderItems, (item) => item.order_id);

  const products: Product[] = rows.products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    unit: toUnitArray(product.units),
    stock: toNumber(product.stock),
    avgCost: toNumber(product.avg_cost),
    totalCostBasis: toNumber(product.total_cost_basis),
    costLayers: parseCostLayers(product.cost_layers),
    saleSubUnits: parseSaleSubUnits(product.sale_sub_units),
    saleSubUnit: undefined,
    minStock: toNumber(product.min_stock),
    note: toOptionalText(product.note),
    variants: (variantsByProduct.get(product.id) ?? []).map<ProductVariant>((variant) => ({
      id: variant.id,
      size: toOptionalText(variant.size),
      color: toOptionalText(variant.color),
      type: toOptionalText(variant.type),
    })),
  }));

  const sales: Sale[] = rows.sales.map((sale) => ({
    id: sale.id,
    receiptNumber: sale.receipt_number,
    customerId: sale.customer_id,
    date: sale.date,
    archivedAt: toOptionalText(sale.archived_at),
    items: sortByLineNo(saleItemsBySale.get(sale.id) ?? []).map<SaleItem>((item) => ({
      productId: item.product_id,
      quantity: toNumber(item.quantity),
      unit: toUnit(item.unit),
      stockQuantity: item.stock_quantity === null ? undefined : toNumber(item.stock_quantity),
      unitPrice: toNumber(item.unit_price),
      avgCostAtSale: toNumber(item.avg_cost_at_sale),
    })),
    total: toNumber(sale.total),
    estimatedProfit: toNumber(sale.estimated_profit),
    paidAmount: toNumber(sale.paid_amount),
    paymentStatus: toPaymentStatus(sale.payment_status),
    telegramStatus: toTelegramStatus(sale.telegram_status),
    notes: toOptionalText(sale.notes),
  }));

  const buyerOrders: BuyerOrder[] = rows.buyerOrders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    buyerId: order.buyer_id,
    customerId: order.customer_id,
    date: order.date,
    updatedAt: order.updated_at_text,
    status: toBuyerOrderStatus(order.status),
    paymentStatus: toPaymentStatus(order.payment_status),
    paidAmount: toNumber(order.paid_amount),
    items: sortByLineNo(orderItemsByOrder.get(order.id) ?? []).map<BuyerOrderItem>((item) => ({
      productId: item.product_id,
      quantity: toNumber(item.quantity),
      unit: toUnit(item.unit),
      stockQuantity: toNumber(item.stock_quantity),
      estimatedUnitPrice:
        item.estimated_unit_price === null ? undefined : toNumber(item.estimated_unit_price),
    })),
    totalEstimate: toNumber(order.total_estimate),
    notes: toOptionalText(order.notes),
    sellerNote: toOptionalText(order.seller_note),
    saleId: toOptionalText(order.sale_id),
  }));

  return {
    ...fallbackState,
    shopName: rows.appSettings?.shop_name?.trim() || fallbackState.shopName,
    shopEmail: toOptionalText(rows.appSettings?.shop_email),
    shopTelegram: toOptionalText(rows.appSettings?.shop_telegram),
    categories: rows.categories.map((category) => ({
      name: category.name,
      defaultUnit: toUnit(category.default_unit) ?? "បេ",
    })),
    markets: rows.markets.map((market) => market.name),
    products,
    factories: rows.factories.map<Factory>((factory) => ({
      id: factory.id,
      name: factory.name,
      phone: factory.phone ?? "",
      location: factory.location ?? "",
      notes: toOptionalText(factory.notes),
    })),
    customers: rows.customers.map<Customer>((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      market: customer.market ?? "",
      telegram: toOptionalText(customer.telegram),
      type: customer.type ?? "Buyer App",
      notes: toOptionalText(customer.notes),
    })),
    buyerAccounts: rows.buyerAccounts.map<BuyerAccount>((account) => ({
      id: account.id,
      email: account.email,
      passwordDigest: account.password_digest ?? "",
      name: account.name,
      phone: toOptionalText(account.phone),
      telegram: toOptionalText(account.telegram),
      market: account.market ?? "",
      location: account.location ?? "",
      customerId: account.customer_id,
      createdAt: account.created_at ?? new Date().toISOString(),
    })),
    stockIns: rows.stockIns.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      factoryId: invoice.factory_id,
      date: invoice.date,
      items: sortByLineNo(stockItemsByInvoice.get(invoice.id) ?? []).map((item) => ({
        productId: item.product_id,
        quantity: toNumber(item.quantity),
        buyPrice: toNumber(item.buy_price),
      })),
      total: toNumber(invoice.total),
      photo: toOptionalText(invoice.photo),
      notes: toOptionalText(invoice.notes),
    })),
    sales,
    buyerOrders,
    payments: rows.payments.map<Payment>((payment) => ({
      id: payment.id,
      customerId: payment.customer_id,
      saleId: toOptionalText(payment.sale_id),
      amount: toNumber(payment.amount),
      date: payment.date,
      note: toOptionalText(payment.note),
    })),
    customerPrices: rows.customerPrices.map<CustomerPrice>((price) => ({
      customerId: price.customer_id,
      productId: price.product_id,
      unit: toUnit(price.unit),
      price: toNumber(price.price),
    })),
    buyerSessionId: undefined,
  };
}

async function loadAllVisibleRows(supabase: SupabaseClient) {
  const [
    appSettings,
    categories,
    markets,
    products,
    productVariants,
    factories,
    customers,
    buyerAccounts,
    stockIns,
    stockInItems,
    sales,
    saleItems,
    buyerOrders,
    buyerOrderItems,
    payments,
    customerPrices,
  ] = await Promise.all([
    selectSingle<AppSettingsRow>(supabase, "app_settings"),
    selectRows<CategoryRow>(supabase, "categories"),
    selectRows<MarketRow>(supabase, "markets"),
    selectRows<ProductRow>(supabase, "products"),
    selectRows<ProductVariantRow>(supabase, "product_variants"),
    selectRows<FactoryRow>(supabase, "factories"),
    selectRows<CustomerRow>(supabase, "customers"),
    selectRows<BuyerAccountRow>(supabase, "buyer_accounts"),
    selectRows<StockInInvoiceRow>(supabase, "stock_in_invoices"),
    selectRows<StockInItemRow>(supabase, "stock_in_items"),
    selectRows<SaleRow>(supabase, "sales"),
    selectRows<SaleItemRow>(supabase, "sale_items"),
    selectRows<BuyerOrderRow>(supabase, "buyer_orders"),
    selectRows<BuyerOrderItemRow>(supabase, "buyer_order_items"),
    selectRows<PaymentRow>(supabase, "payments"),
    selectRows<CustomerPriceRow>(supabase, "customer_prices"),
  ]);

  return {
    appSettings,
    categories,
    markets,
    products,
    productVariants,
    factories,
    customers,
    buyerAccounts,
    stockIns,
    stockInItems,
    sales,
    saleItems,
    buyerOrders,
    buyerOrderItems,
    payments,
    customerPrices,
  };
}

async function saveAdminState(supabase: SupabaseClient, state: AppState) {
  await upsertRows(supabase, "app_settings", [
    {
      id: "default",
      shop_name: state.shopName || "Inventory Genius",
      shop_email: state.shopEmail ?? null,
      shop_telegram: state.shopTelegram ?? null,
    },
  ]);
  await upsertRows(
    supabase,
    "categories",
    state.categories.map((category) => ({
      name: category.name,
      default_unit: category.defaultUnit,
    })),
    "name",
  );
  await upsertRows(
    supabase,
    "markets",
    state.markets.map((market) => ({ name: market })),
    "name",
  );
  await upsertRows(supabase, "products", productRows(state.products));
  await upsertRows(supabase, "factories", factoryRows(state.factories));
  await upsertRows(supabase, "customers", customerRows(state.customers));
  await upsertRows(supabase, "buyer_accounts", buyerAccountRows(state.buyerAccounts));
  await upsertRows(supabase, "stock_in_invoices", stockInRows(state.stockIns));
  await upsertRows(supabase, "sales", saleRows(state.sales));
  await upsertRows(supabase, "buyer_orders", buyerOrderRows(state.buyerOrders));
  await upsertRows(supabase, "payments", paymentRows(state.payments));

  await clearRows(supabase, "product_variants", "id", "__never__");
  await clearRows(supabase, "stock_in_items", "line_no", -1);
  await clearRows(supabase, "sale_items", "line_no", -1);
  await clearRows(supabase, "buyer_order_items", "line_no", -1);
  await clearRows(supabase, "customer_prices", "price", -1);

  await upsertRows(supabase, "product_variants", productVariantRows(state.products));
  await upsertRows(
    supabase,
    "stock_in_items",
    stockInItemRows(state.stockIns),
    "invoice_id,line_no",
  );
  await upsertRows(supabase, "sale_items", saleItemRows(state.sales), "sale_id,line_no");
  await upsertRows(
    supabase,
    "buyer_order_items",
    buyerOrderItemRows(state.buyerOrders),
    "order_id,line_no",
  );
  await upsertRows(
    supabase,
    "customer_prices",
    customerPriceRows(state.customerPrices),
    "customer_id,product_id,unit",
  );
}

async function saveCustomerState(supabase: SupabaseClient, state: AppState, user: User) {
  const email = user.email?.trim().toLocaleLowerCase() ?? "";
  if (!email) return;

  const buyer = state.buyerAccounts.find(
    (account) => account.email.trim().toLocaleLowerCase() === email,
  );
  if (!buyer) return;

  const customer = state.customers.find((item) => item.id === buyer.customerId);
  if (!customer) return;

  customerAuthUserById.set(customer.id, user.id);
  buyerAuthUserById.set(buyer.id, user.id);

  await upsertRows(supabase, "customers", [
    {
      id: customer.id,
      auth_user_id: user.id,
      name: customer.name,
      phone: customer.phone,
      market: customer.market,
      telegram: customer.telegram ?? null,
      type: customer.type,
      notes: customer.notes ?? null,
    },
  ]);
  await upsertRows(supabase, "buyer_accounts", [
    {
      id: buyer.id,
      auth_user_id: user.id,
      email: buyer.email,
      password_digest: buyer.passwordDigest,
      name: buyer.name,
      phone: buyer.phone ?? null,
      telegram: buyer.telegram ?? null,
      market: buyer.market,
      location: buyer.location,
      customer_id: buyer.customerId,
      created_at: buyer.createdAt,
    },
  ]);

  const editableOrders = state.buyerOrders.filter(
    (order) => order.buyerId === buyer.id && order.status === "pending" && !order.saleId,
  );
  await upsertRows(supabase, "buyer_orders", buyerOrderRows(editableOrders));
  await upsertRows(
    supabase,
    "buyer_order_items",
    buyerOrderItemRows(editableOrders),
    "order_id,line_no",
  );
}

export function canSyncRemoteState() {
  return isSupabaseDataSyncReady;
}

export async function loadRemoteState(fallbackState: AppState) {
  latestFallbackState = fallbackState;

  if (!canSyncRemoteState()) return fallbackState;

  const authContext = await getAuthContext();
  if (!authContext) return fallbackState;

  const supabase = getSupabaseClient();
  const rows = await loadAllVisibleRows(supabase);
  return mapLoadedState(fallbackState, rows);
}

export async function saveRemoteState(state: AppState) {
  if (!canSyncRemoteState()) return;

  const authContext = await getAuthContext();
  if (!authContext) return;

  const supabase = getSupabaseClient();
  if (authContext.role === "admin") {
    await saveAdminState(supabase, state);
    return;
  }

  await saveCustomerState(supabase, state, authContext.user);
}

export function subscribeRemoteState(onState: (state: AppState) => void) {
  if (!canSyncRemoteState()) return () => {};

  const supabase = getSupabaseClient();
  let timeout: number | undefined;

  const scheduleReload = () => {
    if (timeout) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      const fallback = latestFallbackState;
      if (!fallback) return;

      void loadRemoteState(fallback)
        .then(onState)
        .catch((error) => {
          console.error("Failed to refresh Supabase data.", error);
        });
    }, 150);
  };

  const channel = supabase.channel("inventory-normalized-state");
  LIVE_TABLES.forEach((table) => {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
      },
      scheduleReload,
    );
  });

  void channel.subscribe();

  return () => {
    if (timeout) window.clearTimeout(timeout);
    void supabase.removeChannel(channel);
  };
}

export function subscribeRemoteAuthState(onChange: () => void) {
  if (!canSyncRemoteState()) return () => {};

  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange(() => {
    window.setTimeout(onChange, 0);
  });

  return () => data.subscription.unsubscribe();
}
