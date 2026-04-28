export type UnitType = "បេ" | "កេស" | "ឈុត" | "យួ" | "ដុំ" | "kg" | "កញ្ចប់";

export interface ProductCategory {
  name: string;
  defaultUnit: UnitType;
}

export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  type?: string;
}

export interface ProductCostLayer {
  quantity: number;
  unitCost: number;
}

export interface ProductSaleSubUnit {
  unit: UnitType;
  quantityPerStockUnit: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: UnitType[];
  stock: number;
  avgCost: number;
  totalCostBasis: number; // running value of the remaining cost layers
  costLayers: ProductCostLayer[];
  saleSubUnits?: ProductSaleSubUnit[];
  saleSubUnit?: ProductSaleSubUnit;
  minStock: number;
  note?: string;
  variants: ProductVariant[];
}

export interface Factory {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  market: string;
  telegram?: string;
  type: string;
  notes?: string;
}

export interface BuyerAccount {
  id: string;
  email: string;
  passwordDigest: string;
  name: string;
  phone?: string;
  telegram?: string;
  market: string;
  location: string;
  customerId: string;
  createdAt: string;
}

export interface StockInItem {
  productId: string;
  quantity: number;
  buyPrice: number;
}

export interface StockInInvoice {
  id: string;
  invoiceNumber: string;
  factoryId: string;
  date: string;
  items: StockInItem[];
  total: number;
  photo?: string; // data URL
  notes?: string;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  unit?: UnitType;
  stockQuantity?: number;
  unitPrice: number;
  avgCostAtSale: number;
}

export type PaymentStatus = "paid" | "unpaid" | "partial";
export type TelegramStatus = "not_sent" | "customer" | "owner" | "both" | "failed";

export interface Sale {
  id: string;
  receiptNumber: string;
  customerId: string;
  date: string;
  archivedAt?: string;
  items: SaleItem[];
  total: number;
  estimatedProfit: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  telegramStatus: TelegramStatus;
  notes?: string;
}

export type BuyerOrderStatus = "pending" | "confirmed" | "packing" | "completed" | "cancelled";

export interface BuyerOrderItem {
  productId: string;
  quantity: number;
  unit?: UnitType;
  stockQuantity: number;
  estimatedUnitPrice?: number;
}

export interface BuyerOrder {
  id: string;
  orderNumber: string;
  buyerId: string;
  customerId: string;
  date: string;
  updatedAt: string;
  status: BuyerOrderStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  items: BuyerOrderItem[];
  totalEstimate: number;
  notes?: string;
  sellerNote?: string;
  saleId?: string;
}

export interface CustomerPrice {
  customerId: string;
  productId: string;
  unit?: UnitType;
  price: number;
}

export interface Payment {
  id: string;
  customerId: string;
  saleId?: string;
  amount: number;
  date: string;
  note?: string;
}

export interface AppState {
  shopEmail?: string;
  categories: ProductCategory[];
  markets: string[];
  products: Product[];
  factories: Factory[];
  customers: Customer[];
  buyerAccounts: BuyerAccount[];
  buyerOrders: BuyerOrder[];
  buyerSessionId?: string;
  stockIns: StockInInvoice[];
  sales: Sale[];
  customerPrices: CustomerPrice[];
  payments: Payment[];
  shopName: string;
  shopTelegram?: string;
}
