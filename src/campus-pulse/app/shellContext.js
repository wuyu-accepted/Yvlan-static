import { inject } from 'vue'

export const productShellContextKey = Symbol('campus-pulse-product-shell')

export function useProductShellContext() {
  return inject(productShellContextKey, null)
}
