import type { Product, ProductCategory, UnitType } from "./types";
import { primaryUnit } from "./units";

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  sack: "ថង់សរដុំ",
  drinkware: "កែវជ័រ",
  storage: "ប្រអប់ស្នោ",
  kitchen: "ចានជ័រ",
  furniture: "កៅអីជ័រ",
};

export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { name: "កែវជ័រ", defaultUnit: "បេ" },
  { name: "ចានជ័រ", defaultUnit: "បេ" },
  { name: "ប្រអប់ស្នោ", defaultUnit: "បេ" },
  { name: "ទុយោ", defaultUnit: "បេ" },
  { name: "ចង្កឹះ", defaultUnit: "បេ" },
  { name: "ចង្កាក់", defaultUnit: "បេ" },
  { name: "គម្រប់កែវជ័រ", defaultUnit: "បេ" },
  { name: "ថង់ពណ៍", defaultUnit: "បេ" },
  { name: "ថង់សររាយ", defaultUnit: "បេ" },
  { name: "ថង់សរដុំ", defaultUnit: "បេ" },
  { name: "ថង់ម្កុដ", defaultUnit: "បេ" },
  { name: "ថង់ស្នែង", defaultUnit: "បេ" },
  { name: "ថង់ខ្មៅរាយ", defaultUnit: "បេ" },
  { name: "ថង់ខ្មៅដុំ", defaultUnit: "បេ" },
  { name: "កៅស៊ូ", defaultUnit: "បេ" },
];
const KHMER_CONSONANTS = [
  "ក",
  "ខ",
  "គ",
  "ឃ",
  "ង",
  "ច",
  "ឆ",
  "ជ",
  "ឈ",
  "ញ",
  "ដ",
  "ឋ",
  "ឌ",
  "ឍ",
  "ណ",
  "ត",
  "ថ",
  "ទ",
  "ធ",
  "ន",
  "ប",
  "ផ",
  "ព",
  "ភ",
  "ម",
  "យ",
  "រ",
  "ល",
  "វ",
  "ស",
  "ហ",
  "ឡ",
  "អ",
] as const;
const KHMER_CONSONANT_ORDER = new Map(KHMER_CONSONANTS.map((char, index) => [char, index]));
const KHMER_COLLATOR = new Intl.Collator("km", {
  numeric: true,
  sensitivity: "base",
});
const DEFAULT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

type RawCategory = ProductCategory | string | null | undefined;

export function normalizeCategoryName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return LEGACY_CATEGORY_MAP[trimmed.toLocaleLowerCase()] ?? trimmed;
}

function categoryKey(name: string) {
  return normalizeCategoryName(name).toLocaleLowerCase();
}

export function sameCategoryName(a: string, b: string) {
  return categoryKey(a) === categoryKey(b);
}

function extractKhmerConsonants(value: string) {
  return Array.from(value).filter((char) => KHMER_CONSONANT_ORDER.has(char));
}

export function compareCategoryNames(a: string, b: string) {
  const leftName = normalizeCategoryName(a);
  const rightName = normalizeCategoryName(b);
  const leftConsonants = extractKhmerConsonants(leftName);
  const rightConsonants = extractKhmerConsonants(rightName);
  const hasLeftKhmer = leftConsonants.length > 0;
  const hasRightKhmer = rightConsonants.length > 0;

  if (hasLeftKhmer !== hasRightKhmer) {
    return hasLeftKhmer ? -1 : 1;
  }

  const maxLength = Math.max(leftConsonants.length, rightConsonants.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftChar = leftConsonants[index];
    const rightChar = rightConsonants[index];

    if (leftChar === undefined || rightChar === undefined) {
      if (leftChar === rightChar) continue;
      return leftChar === undefined ? -1 : 1;
    }

    const leftIndex = KHMER_CONSONANT_ORDER.get(leftChar)!;
    const rightIndex = KHMER_CONSONANT_ORDER.get(rightChar)!;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  }

  if (hasLeftKhmer && hasRightKhmer) {
    return KHMER_COLLATOR.compare(leftName, rightName);
  }

  return DEFAULT_COLLATOR.compare(leftName, rightName);
}

function createCategory(raw: RawCategory, fallbackUnit: UnitType = "បេ"): ProductCategory | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const name = normalizeCategoryName(raw);
    return name ? { name, defaultUnit: fallbackUnit } : null;
  }

  const name = normalizeCategoryName(raw.name);
  if (!name) return null;

  return {
    name,
    defaultUnit: primaryUnit(raw.defaultUnit, fallbackUnit),
  };
}

export function normalizeCategories(
  rawCategories: RawCategory[] | undefined,
  products: Array<Pick<Product, "category" | "unit">> = [],
  options?: { includeDefaults?: boolean },
) {
  const merged = new Map<string, ProductCategory>();

  const add = (raw: RawCategory, fallbackUnit?: UnitType) => {
    const category = createCategory(raw, fallbackUnit);
    if (!category) return;
    const key = categoryKey(category.name);
    if (!merged.has(key)) merged.set(key, category);
  };

  rawCategories?.forEach((category) => add(category));
  products.forEach((product) =>
    add(
      { name: product.category, defaultUnit: primaryUnit(product.unit) },
      primaryUnit(product.unit),
    ),
  );
  if (options?.includeDefaults) {
    DEFAULT_CATEGORIES.forEach((category) => add(category, category.defaultUnit));
  }

  return Array.from(merged.values()).sort((left, right) =>
    compareCategoryNames(left.name, right.name),
  );
}
