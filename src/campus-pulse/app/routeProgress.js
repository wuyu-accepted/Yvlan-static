import { readonly, ref } from 'vue'

const loading = ref(false)
let installed = false

export const productRouteLoading = readonly(loading)

export function installProductRouteProgress(router) {
  if (installed) return
  installed = true
  router.beforeEach((to, from) => {
    if (to.path !== from.path && (to.meta.productShell || from.meta.productShell)) loading.value = true
  })
  router.afterEach(() => {
    requestAnimationFrame(() => { loading.value = false })
  })
  router.onError(() => { loading.value = false })
}
