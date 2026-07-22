import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// tiny helper we use everywhere for cleaner tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
