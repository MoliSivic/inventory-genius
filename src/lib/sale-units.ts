import type { Product, ProductSaleSubUnit, SaleItem, UnitType } from "./types";
import { primaryUnit } from "./units";

export const THANG_SOR_DOM_PACKAGE_COUNT = 50;
const THANG_SOR_DOM_PACKAGE_UNIT: UnitType = "កញ្ចប់";

type ProductUnitShape = Pick<Product, "name" | "unit"> &
  Partial<Pick<Product, "saleSubUnit" | "saleSubUnits">>;

export interface ProductSaleUnitOption {
  unit: UnitType;
  quantityPerStockUnit: number;
}

interface ProductSaleUnitChainOption extends ProductSaleUnitOption {
  parentUnit: UnitType;
  quantityPerParentUnit: number;
}

function roundSaleUnitValue(value: number) {
  return Number(value.toFixed(4));
}

export function isThangSorDomKhlokProduct(name: string) {
  const trimmed = name.trim();
  if (!trimmed.includes("ឃ្លោក")) return false;
  return trimmed.startsWith("ថង់សរដុំ") || trimmed.startsWith("ថង់ខ្មៅដុំ");
}

export function normalizeProductSaleSubUnits(product: ProductUnitShape): ProductSaleSubUnit[] {
  const stockUnit = primaryUnit(product.unit);
  const configuredSubUnits =
    Array.isArray(product.saleSubUnits) && product.saleSubUnits.length > 0
      ? product.saleSubUnits
      : product.saleSubUnit
        ? [product.saleSubUnit]
        : [];
  const normalizedSubUnits = new Map<UnitType, ProductSaleSubUnit>();

  for (const subUnit of configuredSubUnits) {
    if (!subUnit || subUnit.unit === stockUnit) continue;

    const quantityPerStockUnit = roundSaleUnitValue(Math.max(subUnit.quantityPerStockUnit, 0));
    if (quantityPerStockUnit <= 0) continue;

    if (!normalizedSubUnits.has(subUnit.unit)) {
      normalizedSubUnits.set(subUnit.unit, {
        unit: subUnit.unit,
        quantityPerStockUnit,
      });
    }
  }

  if (
    normalizedSubUnits.size === 0 &&
    stockUnit === "បេ" &&
    isThangSorDomKhlokProduct(product.name)
  ) {
    normalizedSubUnits.set(THANG_SOR_DOM_PACKAGE_UNIT, {
      unit: THANG_SOR_DOM_PACKAGE_UNIT,
      quantityPerStockUnit: THANG_SOR_DOM_PACKAGE_COUNT,
    });
  }

  return Array.from(normalizedSubUnits.values());
}

export function getProductSaleSubUnitOptions(product: ProductUnitShape) {
  return normalizeProductSaleSubUnits(product);
}

function getProductSaleUnitChain(product: ProductUnitShape): ProductSaleUnitChainOption[] {
  const stockUnit = primaryUnit(product.unit);
  let previousUnit = stockUnit;
  let cumulativeQuantityPerStockUnit = 1;

  return getProductSaleSubUnitOptions(product).map((subUnit) => {
    const quantityPerParentUnit = roundSaleUnitValue(Math.max(subUnit.quantityPerStockUnit, 0));
    cumulativeQuantityPerStockUnit = roundSaleUnitValue(
      cumulativeQuantityPerStockUnit * quantityPerParentUnit,
    );

    const option: ProductSaleUnitChainOption = {
      unit: subUnit.unit,
      parentUnit: previousUnit,
      quantityPerParentUnit,
      quantityPerStockUnit: cumulativeQuantityPerStockUnit,
    };

    previousUnit = subUnit.unit;
    return option;
  });
}

export function getProductSaleUnitOptions(product: ProductUnitShape): ProductSaleUnitOption[] {
  const stockUnit = primaryUnit(product.unit);
  return [
    {
      unit: stockUnit,
      quantityPerStockUnit: 1,
    },
    ...getProductSaleUnitChain(product).map((option) => ({
      unit: option.unit,
      quantityPerStockUnit: option.quantityPerStockUnit,
    })),
  ];
}

export function normalizeSaleUnit(product: ProductUnitShape, unit?: UnitType) {
  const options = getProductSaleUnitOptions(product);
  return options.find((option) => option.unit === unit)?.unit ?? options[0].unit;
}

export function getSaleUnitQuantityPerStockUnit(product: ProductUnitShape, unit?: UnitType) {
  const normalizedUnit = normalizeSaleUnit(product, unit);
  return (
    getProductSaleUnitOptions(product).find((option) => option.unit === normalizedUnit)
      ?.quantityPerStockUnit ?? 1
  );
}

export function isSaleSubUnit(product: ProductUnitShape, unit?: UnitType) {
  return normalizeSaleUnit(product, unit) !== primaryUnit(product.unit);
}

export function getProductSaleSubUnitOption(product: ProductUnitShape) {
  return getProductSaleSubUnitOptions(product)[0] ?? null;
}

export function getSaleUnitParentUnit(product: ProductUnitShape, unit?: UnitType) {
  const normalizedUnit = normalizeSaleUnit(product, unit);
  return (
    getProductSaleUnitChain(product).find((option) => option.unit === normalizedUnit)?.parentUnit ??
    primaryUnit(product.unit)
  );
}

export function getSaleUnitQuantityPerParentUnit(product: ProductUnitShape, unit?: UnitType) {
  const normalizedUnit = normalizeSaleUnit(product, unit);
  return (
    getProductSaleUnitChain(product).find((option) => option.unit === normalizedUnit)
      ?.quantityPerParentUnit ?? 1
  );
}

export function shouldLimitSaleSubUnitToSingleStockUnit(
  product: ProductUnitShape,
  unit?: UnitType,
) {
  return (
    isSaleSubUnit(product, unit) &&
    normalizeSaleUnit(product, unit) === THANG_SOR_DOM_PACKAGE_UNIT &&
    getSaleUnitParentUnit(product, unit) === primaryUnit(product.unit)
  );
}

export function convertSaleQuantityToStockQuantity(
  product: ProductUnitShape,
  quantity: number,
  unit?: UnitType,
) {
  return roundSaleUnitValue(
    Math.max(quantity, 0) / getSaleUnitQuantityPerStockUnit(product, unit),
  );
}

export function convertStockQuantityToSaleQuantity(
  product: ProductUnitShape,
  stockQuantity: number,
  unit?: UnitType,
) {
  return roundSaleUnitValue(
    Math.max(stockQuantity, 0) * getSaleUnitQuantityPerStockUnit(product, unit),
  );
}

export function convertStockUnitPriceToSaleUnitPrice(
  product: ProductUnitShape,
  stockUnitPrice: number,
  unit?: UnitType,
) {
  return roundSaleUnitValue(
    Math.max(stockUnitPrice, 0) / getSaleUnitQuantityPerStockUnit(product, unit),
  );
}

export function getMaxSaleQuantityFromStock(
  product: ProductUnitShape,
  availableStockQuantity: number,
  unit?: UnitType,
) {
  const normalizedUnit = normalizeSaleUnit(product, unit);
  const converted = convertStockQuantityToSaleQuantity(
    product,
    availableStockQuantity,
    normalizedUnit,
  );

  if (!shouldLimitSaleSubUnitToSingleStockUnit(product, normalizedUnit)) {
    return roundSaleUnitValue(converted);
  }

  return Math.max(
    Math.min(
      Math.floor(converted),
      getSaleUnitQuantityPerParentUnit(product, normalizedUnit) - 1,
    ),
    0,
  );
}

export function normalizeSaleQuantityFromStock(
  product: ProductUnitShape,
  quantity: number,
  availableStockQuantity: number,
  unit?: UnitType,
) {
  const maxQuantity = getMaxSaleQuantityFromStock(product, availableStockQuantity, unit);
  const clamped = Math.min(Math.max(quantity, 0), maxQuantity);

  if (!shouldLimitSaleSubUnitToSingleStockUnit(product, unit)) {
    return roundSaleUnitValue(clamped);
  }

  return Math.floor(clamped);
}

export function getDisplayStockUnitQuantity(product: ProductUnitShape, stockQuantity: number) {
  if (getProductSaleSubUnitOptions(product).length === 0) {
    return roundSaleUnitValue(Math.max(stockQuantity, 0));
  }

  return Math.max(Math.floor(stockQuantity), 0);
}

export function getDisplaySubUnitQuantity(
  product: ProductUnitShape,
  stockQuantity: number,
  unit?: UnitType,
) {
  const subUnit =
    getProductSaleSubUnitOptions(product).find((option) => option.unit === unit) ??
    getProductSaleSubUnitOption(product);
  if (!subUnit) return null;

  return convertStockQuantityToSaleQuantity(product, stockQuantity, subUnit.unit);
}

export function formatProductSaleUnits(product: ProductUnitShape) {
  return getProductSaleUnitOptions(product)
    .map((option) => option.unit)
    .join(" / ");
}

export function getSaleUnitConversionNote(product: ProductUnitShape) {
  const saleUnitChain = getProductSaleUnitChain(product);
  if (saleUnitChain.length === 0) return null;

  return saleUnitChain
    .map(
      (option) =>
        `1 ${option.parentUnit} = ${option.quantityPerParentUnit} ${option.unit}`,
    )
    .join(" · ");
}

export function resolveSaleItemUnit(item: Pick<SaleItem, "unit">, product: ProductUnitShape) {
  return normalizeSaleUnit(product, item.unit);
}

export function resolveSaleItemStockQuantity(
  item: Pick<SaleItem, "quantity" | "stockQuantity" | "unit">,
  product: ProductUnitShape,
) {
  if (typeof item.stockQuantity === "number") {
    return roundSaleUnitValue(Math.max(item.stockQuantity, 0));
  }

  return convertSaleQuantityToStockQuantity(product, item.quantity, resolveSaleItemUnit(item, product));
}
