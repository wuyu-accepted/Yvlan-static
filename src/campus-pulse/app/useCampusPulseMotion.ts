import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap } from 'gsap'

type MotionOptions = { autoIntro?: boolean; pageSelector?: string }
type PulseOptions = { y?: number; duration?: number; scale?: number }

/** Brief, scoped feedback. Content stays visible before JS and under reduced motion. */
export function useCampusPulseMotion(root: Ref<HTMLElement | null>, options: MotionOptions = {}) {
  let media: ReturnType<typeof gsap.matchMedia> | null = null
  let context: ReturnType<typeof gsap.context> | null = null
  let rootNode: HTMLElement | null = null
  let reducedMotion = true

  function scoped(selector: string): Element[] {
    return rootNode ? Array.from(rootNode.querySelectorAll(selector)) : []
  }

  function playPageIntro() {
    const page = rootNode?.querySelector(options.pageSelector || '[data-cp-motion-page]')
      || rootNode?.querySelector('.product-main-content > *')
    if (!page || !context || reducedMotion) return
    // Never transform a page ancestor: fixed playback controls must stay viewport-bound.
    context.add(() => {
      gsap.killTweensOf(page)
      gsap.fromTo(page, { opacity: 0.82 }, {
        opacity: 1, duration: 0.18, ease: 'power3.out', clearProps: 'opacity',
      })
    })
  }

  function pulse(selector: string, settings: PulseOptions = {}) {
    const targets = scoped(selector).slice(0, 6)
    if (!targets.length || !context || reducedMotion) return
    context.add(() => {
      gsap.killTweensOf(targets)
      gsap.fromTo(targets, { opacity: 0.78, y: settings.y ?? 4, scale: 1 }, {
        opacity: 1, y: 0, scale: settings.scale ?? 1,
        duration: settings.duration ?? 0.2, stagger: 0.012,
        ease: 'power3.out', overwrite: 'auto', clearProps: 'opacity,transform',
      })
    })
  }

  function setup() {
    if (!rootNode) return
    media = gsap.matchMedia()
    media.add({
      standard: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)',
    }, match => {
      reducedMotion = Boolean(match.conditions?.reduced)
      context = gsap.context(() => {}, rootNode!)
      if (options.autoIntro !== false) playPageIntro()
      return () => { context?.revert(); context = null }
    }, rootNode)
  }

  onMounted(() => {
    rootNode = root.value
    void nextTick(() => { if (rootNode) setup() })
  })
  onBeforeUnmount(() => {
    media?.revert()
    context?.revert()
    context = null
    media = null
    rootNode = null
  })
  return { playPageIntro, pulse, refresh: async () => { await nextTick(); playPageIntro() } }
}
