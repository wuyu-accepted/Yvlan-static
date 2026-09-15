import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap } from 'gsap'

type MotionOptions = {
  autoIntro?: boolean
  pageSelector?: string
}

type PulseOptions = {
  y?: number
  duration?: number
  scale?: number
}

/** Shared GSAP motion layer for the CampusPulse shell and live views. */
export function useCampusPulseMotion(
  root: Ref<HTMLElement | null>,
  options: MotionOptions = {},
) {
  let media: ReturnType<typeof gsap.matchMedia> | null = null
  let rootNode: HTMLElement | null = null
  let reducedMotion = false

  function scoped(selector: string): Element[] {
    return rootNode ? Array.from(rootNode.querySelectorAll(selector)) : []
  }

  function pageElement(): HTMLElement | null {
    if (!rootNode) return null
    const selector = options.pageSelector || '[data-cp-motion-page]'
    return rootNode.querySelector(selector) as HTMLElement | null
      || rootNode.querySelector('.product-main-content > *') as HTMLElement | null
  }

  function playPageIntro() {
    const page = pageElement()
    if (!page) return
    const innerPage = (page.firstElementChild as HTMLElement | null) || page
    const blocks = Array.from(innerPage.children)
      .filter((element) => !element.hasAttribute('data-motion-static'))
      .slice(0, 14)

    gsap.killTweensOf([page, ...blocks])
    if (reducedMotion) {
      gsap.set([page, ...blocks], { clearProps: 'opacity,transform,visibility' })
      return
    }
    gsap.fromTo(page, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power3.out' })
    if (blocks.length) {
      gsap.fromTo(blocks, { autoAlpha: 0, y: 10 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        stagger: 0.045,
        delay: 0.08,
        ease: 'power2.out',
      })
    }
  }

  function playShellIntro() {
    if (!rootNode || reducedMotion) return
    const shellParts = scoped('.product-sidebar, .product-topbar, .source-status-bar')
    if (!shellParts.length) return
    gsap.killTweensOf(shellParts)
    gsap.fromTo(shellParts, { autoAlpha: 0, y: -7 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.36,
      stagger: 0.045,
      ease: 'power2.out',
    })
  }

  function pulse(selector: string, pulseOptions: PulseOptions = {}) {
    const targets = scoped(selector)
    if (!targets.length) return
    gsap.killTweensOf(targets)
    if (reducedMotion) {
      gsap.set(targets, { clearProps: 'opacity,transform,visibility' })
      return
    }
    gsap.fromTo(targets, { autoAlpha: 0.72, y: pulseOptions.y ?? 7, scale: 1 }, {
      autoAlpha: 1,
      y: 0,
      scale: pulseOptions.scale ?? 1,
      duration: pulseOptions.duration ?? 0.28,
      stagger: 0.035,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  function setup() {
    if (!rootNode) return
    media?.revert()
    media = gsap.matchMedia()
    media.add({ reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      reducedMotion = Boolean(context.conditions?.reduced)
      playShellIntro()
      if (options.autoIntro !== false) playPageIntro()
    }, rootNode)
  }

  onMounted(() => {
    rootNode = root.value
    if (!rootNode) return
    void nextTick(setup)
  })

  onBeforeUnmount(() => {
    media?.revert()
    if (rootNode) gsap.killTweensOf(rootNode.querySelectorAll('*'))
    media = null
    rootNode = null
  })

  return { playPageIntro, pulse, refresh: async () => { await nextTick(); playPageIntro() } }
}
