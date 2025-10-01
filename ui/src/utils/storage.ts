/**
 * Safe localStorage utilities with fallbacks
 */

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, 'test')
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Get item from localStorage with JSON parsing
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (!isLocalStorageAvailable()) {
    return defaultValue
  }
  
  try {
    const item = localStorage.getItem(key)
    if (item === null) {
      return defaultValue
    }
    return JSON.parse(item)
  } catch (error) {
    console.warn(`Failed to parse localStorage item "${key}":`, error)
    return defaultValue
  }
}

/**
 * Set item in localStorage with JSON serialization
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (!isLocalStorageAvailable()) {
    return false
  }
  
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`Failed to save to localStorage "${key}":`, error)
    return false
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false
  }
  
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Failed to remove localStorage item "${key}":`, error)
    return false
  }
}

/**
 * Clear all localStorage items with optional prefix filter
 */
export function clearStorage(prefix?: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false
  }
  
  try {
    if (prefix) {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } else {
      localStorage.clear()
    }
    return true
  } catch (error) {
    console.warn('Failed to clear localStorage:', error)
    return false
  }
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { used: number; available: boolean } {
  if (!isLocalStorageAvailable()) {
    return { used: 0, available: false }
  }
  
  let used = 0
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length
      }
    }
  } catch {
    used = -1
  }
  
  return { used, available: true }
}