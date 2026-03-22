import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "./i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDisplayName(
  channel: { name: string; english_name?: string },
  locale: Locale
): string {
  if (locale === "ja") return channel.name;
  return channel.english_name || channel.name;
}
