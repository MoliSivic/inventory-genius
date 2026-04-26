import type { UnitType } from "./types";

export const UNIT_OPTIONS: UnitType[] = ["បេ", "កេស", "ឈុត", "យួ", "ដុំ", "kg", "កញ្ចប់"];

const LEGACY_UNIT_MAP: Record<string, UnitType> = {
  បេ: "បេ",
  កេស: "កេស",
  ឈុត: "ឈុត",
  យួ: "យួ",
  យូរ: "យួ",
  ដុំ: "ដុំ",
  kg: "kg",
  កញ្ចប់: "កញ្ចប់",
  pcs: "ដុំ",
  piece: "ដុំ",
  pieces: "ដុំ",
  set: "ឈុត",
  sets: "ឈុត",
  box: "កេស",
  boxes: "កេស",
  ប្រអប់: "កេស",
  គីឡូ: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  bag: "បេ",
  bags: "បេ",
  package: "កញ្ចប់",
  packages: "កញ្ចប់",
  pack: "កញ្ចប់",
  packs: "កញ្ចប់",
};

function isUnitType(value: string): value is UnitType {
  return UNIT_OPTIONS.includes(value as UnitType);
}

export function normalizeUnitName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return LEGACY_UNIT_MAP[trimmed.toLocaleLowerCase()] ?? trimmed;
}

export function normalizeUnits(input: unknown, fallback: UnitType = "បេ") {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input
          .split("/")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  const unique = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeUnitName(value))
        .filter(Boolean),
    ),
  );
  const normalized = unique.filter(isUnitType).slice(0, 2);

  return normalized.length > 0 ? normalized : [fallback];
}

export function normalizeProductUnits(input: unknown, fallback: UnitType = "បេ") {
  return normalizeUnits(input, fallback).slice(0, 1);
}

export function primaryUnit(input: unknown, fallback: UnitType = "បេ") {
  return normalizeUnits(input, fallback)[0];
}

export function formatUnits(input: unknown) {
  return normalizeUnits(input).join(" / ");
}
