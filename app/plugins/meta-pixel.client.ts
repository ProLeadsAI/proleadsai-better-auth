declare global {
  interface Window {
    fbq: (...args: any[]) => void
    _fbq?: any
  }
}

declare function fbq(...args: any[]): void

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const pixelId = config.public.facebookPixelId

  if (!pixelId || typeof window === 'undefined') {
    return
  }

  const trackPageView = () => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView')
    }
  }

  ;(function (
    f: Window & typeof globalThis,
    b: Document,
    e: string,
    v?: any,
    n?: any,
    t?: HTMLScriptElement,
    s?: Node
  ) {
    if (f.fbq)
      return

    n = f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod(...args) : n.queue.push(args)
    }
    if (!f._fbq)
      f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = 'https://connect.facebook.net/en_US/fbevents.js'
    t.onload = function () {
      fbq('init', pixelId)
      trackPageView()
    }
    s = b.getElementsByTagName(e)[0]
    s?.parentNode?.insertBefore(t, s)
  })(window, document, 'script')

  nuxtApp.hook('page:finish', () => {
    trackPageView()
  })
})
