import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getBaseURL = () => {
  const pathMatch = window.location.pathname.match(/\/instance\/([^\/]+)/)
  if (pathMatch && pathMatch.length > 1) {
    return pathMatch[0] + '/'
  }
  return import.meta.env.VITE_BASE_URL || '/'
}

export const prefixURL = (url: string) => `${getBaseURL()}${url}`