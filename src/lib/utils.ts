import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const KHMER_NUMERAL_MAP: Record<string, string> = {
  "០": "0",
  "១": "1",
  "២": "2",
  "៣": "3",
  "៤": "4",
  "៥": "5",
  "៦": "6",
  "៧": "7",
  "៨": "8",
  "៩": "9",
};

export function displayZeroAsPlaceholder(value: number) {
  return value === 0 ? "" : value;
}

export function normalizeLocalizedDigits(value: string) {
  return value.replace(/[០-៩]/g, (digit) => KHMER_NUMERAL_MAP[digit] ?? digit).trim();
}

export function parseNumericInput(value: string) {
  const normalizedValue = normalizeLocalizedDigits(value);
  return normalizedValue === "" ? 0 : Number(normalizedValue);
}

function normalizedSortText(value: string) {
  return value
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function extractSortNumbers(value: string) {
  return Array.from(value.matchAll(/\d+(?:\.\d+)?/g), (match) => Number(match[0]));
}

export function compareTextWithAscendingNumbers(left: string, right: string) {
  const textCompare = normalizedSortText(left).localeCompare(normalizedSortText(right), undefined, {
    sensitivity: "base",
  });
  if (textCompare !== 0) return textCompare;

  const leftNumbers = extractSortNumbers(left);
  const rightNumbers = extractSortNumbers(right);
  const maxLength = Math.max(leftNumbers.length, rightNumbers.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftNumber = leftNumbers[index];
    const rightNumber = rightNumbers[index];

    if (leftNumber === undefined || rightNumber === undefined) {
      if (leftNumber === rightNumber) continue;
      return leftNumber === undefined ? 1 : -1;
    }

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
  }

  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
