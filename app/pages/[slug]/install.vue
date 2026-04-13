<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

definePageMeta({
  layout: 'dashboard'
})

type InstallMode = 'inline' | 'floating'
type HeroImageMode = 'default' | 'none' | 'custom'
const DEFAULT_SELECT_VALUE = '__default'

const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()
const runtimeConfig = useRuntimeConfig()
const requestUrl = useRequestURL()
const toast = useToast()
const { copy } = useClipboard()

const installMode = ref<InstallMode>('inline')
const instructionsModalOpen = ref(false)
const emailModalOpen = ref(false)
const floatingPreviewOpen = ref(false)
const sendingEmail = ref(false)
const includeStyleBlock = ref(false)

const emailForm = reactive({
  recipientEmail: ''
})

const installModes = [
  {
    id: 'inline' as const,
    label: 'Inline section',
    description: 'Embed the estimator directly in the content area of a page.'
  },
  {
    id: 'floating' as const,
    label: 'Floating button',
    description: 'Show a launcher button that opens the estimator in a slide-out panel.'
  }
]

const fontOptions = [
  { label: 'Default (system)', value: DEFAULT_SELECT_VALUE },
  { label: 'Inter', value: 'Inter' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Oswald', value: 'Oswald' }
]

const buttonPositionOptions = [
  { label: 'Bottom right', value: 'bottom-right' },
  { label: 'Bottom left', value: 'bottom-left' },
  { label: 'Bottom center', value: 'bottom-center' },
  { label: 'Left edge', value: 'left-edge' },
  { label: 'Right edge', value: 'right-edge' }
]

const backgroundStyleOptions = [
  { label: 'Default', value: 'none' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Custom color', value: 'custom' }
]

const heroImageOptions = [
  { label: 'Default image', value: 'default' },
  { label: 'Hide image', value: 'none' },
  { label: 'Custom image URL', value: 'custom' }
]

const form = reactive({
  heading: 'Free Roof Estimate Instantly',
  subheading: 'Enter your address to see your roof size, estimated cost, and steepness.',
  primaryColor: '#facc15',
  buttonText: 'Get Roof Estimate',
  buttonEmoji: '🏠',
  buttonPosition: 'bottom-right',
  textColor: '#1c1917',
  bgStyle: 'none',
  bgColor: '#f5f5f4',
  headingFont: 'Inter',
  textFont: 'Inter',
  headingColor: '#1c1917',
  textColorShortcode: '#44403c',
  headingSize: '',
  textSize: '',
  heroImageMode: 'default' as HeroImageMode,
  heroImageUrl: '',
  disableWhenUnavailable: true
})

const activeOrgId = computed(() => activeOrg.value?.data?.id || '')
const activeOrgName = computed(() => activeOrg.value?.data?.name || 'this organization')

function toSelectValue(value: string) {
  return value || DEFAULT_SELECT_VALUE
}

function fromSelectValue(value: string) {
  return value === DEFAULT_SELECT_VALUE ? '' : value
}

const headingFontModel = computed({
  get: () => toSelectValue(form.headingFont),
  set: (value) => { form.headingFont = fromSelectValue(value) }
})

const textFontModel = computed({
  get: () => toSelectValue(form.textFont),
  set: (value) => { form.textFont = fromSelectValue(value) }
})

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

const widgetBaseUrl = computed(() => stripTrailingSlash(runtimeConfig.public.widgetBaseUrl || 'https://widgets.proleadsai.com'))
const appBaseUrl = computed(() => {
  const configuredBaseUrl = runtimeConfig.public.baseURL || requestUrl.origin
  return stripTrailingSlash(configuredBaseUrl)
})
const apiBaseUrl = computed(() => `${appBaseUrl.value}/api`)
const iframeBaseUrl = computed(() => `${widgetBaseUrl.value}/iframe`)
const widgetStatusUrl = computed(() => `${apiBaseUrl.value}/organization/${activeOrgId.value}/widget-status`)

function setParam(params: URLSearchParams, key: string, value?: string | boolean) {
  if (typeof value === 'boolean') {
    if (value) {
      params.set(key, 'true')
    }
    return
  }

  const normalized = value?.trim() || ''
  if (!normalized)
    return

  params.set(key, normalized)
}

function buildInlineIframeUrl() {
  const params = new URLSearchParams()

  setParam(params, 'org-id', activeOrgId.value)
  setParam(params, 'api-url', apiBaseUrl.value)
  setParam(params, 'display-mode', 'inline')
  setParam(params, 'disable-when-unavailable', form.disableWhenUnavailable)
  setParam(params, 'heading', form.heading)
  setParam(params, 'subheading', form.subheading)
  setParam(params, 'primary-color', form.primaryColor)
  setParam(params, 'bg-style', form.bgStyle)

  if (form.bgStyle === 'custom') {
    setParam(params, 'bg-color', form.bgColor)
  }

  if (form.heroImageMode === 'none') {
    setParam(params, 'hero-image', 'none')
  } else if (form.heroImageMode === 'custom') {
    setParam(params, 'hero-image', form.heroImageUrl)
  }

  setParam(params, 'heading-font', form.headingFont)
  setParam(params, 'heading-color', form.headingColor)
  setParam(params, 'text-font', form.textFont)
  setParam(params, 'text-color-shortcode', form.textColorShortcode)
  setParam(params, 'heading-size', form.headingSize)
  setParam(params, 'text-size', form.textSize)

  return `${iframeBaseUrl.value}?${params.toString()}`
}

function buildFloatingIframeUrl() {
  const params = new URLSearchParams()

  setParam(params, 'org-id', activeOrgId.value)
  setParam(params, 'api-url', apiBaseUrl.value)
  setParam(params, 'display-mode', 'floating')
  setParam(params, 'disable-when-unavailable', form.disableWhenUnavailable)
  setParam(params, 'heading', form.heading)
  setParam(params, 'subheading', form.subheading)
  setParam(params, 'primary-color', form.primaryColor)
  setParam(params, 'text-color', form.textColor)
  setParam(params, 'button-text', form.buttonText)
  setParam(params, 'button-emoji', form.buttonEmoji)
  setParam(params, 'button-position', form.buttonPosition)
  setParam(params, 'bg-style', form.bgStyle)

  if (form.bgStyle === 'custom') {
    setParam(params, 'bg-color', form.bgColor)
  }

  if (form.heroImageMode === 'none') {
    setParam(params, 'hero-image', 'none')
  } else if (form.heroImageMode === 'custom') {
    setParam(params, 'hero-image', form.heroImageUrl)
  }

  setParam(params, 'heading-font', form.headingFont)
  setParam(params, 'heading-color', form.headingColor)
  setParam(params, 'text-font', form.textFont)
  setParam(params, 'text-color-shortcode', form.textColorShortcode)
  setParam(params, 'heading-size', form.headingSize)
  setParam(params, 'text-size', form.textSize)

  return `${iframeBaseUrl.value}?${params.toString()}`
}

const inlineIframeUrl = computed(() => buildInlineIframeUrl())
const floatingIframeUrl = computed(() => buildFloatingIframeUrl())

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getFloatingButtonInlineStyle() {
  const positionStyles: Record<string, string> = {
    'bottom-right': 'bottom:1.25rem;right:1.25rem;',
    'bottom-left': 'bottom:1.25rem;left:1.25rem;',
    'bottom-center': 'bottom:1.25rem;left:50%;transform:translateX(-50%);',
    'left-edge': 'left:0;top:50%;transform:translateY(-50%);border-radius:0 .75rem .75rem 0;writing-mode:vertical-lr;text-orientation:sideways;',
    'right-edge': 'right:0;top:50%;transform:translateY(-50%);border-radius:.75rem 0 0 .75rem;writing-mode:vertical-rl;text-orientation:mixed;'
  }

  return [
    'position:absolute',
    'z-index:30',
    'display:flex',
    'align-items:center',
    'gap:.5rem',
    'padding:.85rem 1.25rem',
    'font-size:.875rem',
    'font-weight:700',
    'box-shadow:0 18px 40px rgba(15,23,42,.18)',
    'cursor:pointer',
    'border:0',
    'border-radius:9999px',
    `background:${form.primaryColor}`,
    `color:${form.textColor}`,
    positionStyles[form.buttonPosition] || positionStyles['bottom-right']
  ].join(';')
}

function getFloatingButtonPreviewStyle() {
  const positionStyles: Record<string, string> = {
    'bottom-right': 'bottom:1rem;right:1rem;',
    'bottom-left': 'bottom:1rem;left:1rem;',
    'bottom-center': 'bottom:1rem;left:50%;transform:translateX(-50%);',
    'left-edge': 'left:.5rem;top:50%;transform:translateY(-50%);border-radius:.75rem;writing-mode:vertical-lr;text-orientation:sideways;',
    'right-edge': 'right:.5rem;top:50%;transform:translateY(-50%);border-radius:.75rem;writing-mode:vertical-rl;text-orientation:mixed;'
  }

  return [
    'position:absolute',
    'z-index:30',
    'display:flex',
    'align-items:center',
    'gap:.5rem',
    'padding:.85rem 1.1rem',
    'font-size:.875rem',
    'font-weight:700',
    'box-shadow:0 18px 40px rgba(15,23,42,.18)',
    'cursor:pointer',
    'border:0',
    'border-radius:9999px',
    'max-width:calc(100% - 1rem)',
    `background:${form.primaryColor}`,
    `color:${form.textColor}`,
    positionStyles[form.buttonPosition] || positionStyles['bottom-right']
  ].join(';')
}

const floatingButtonPreviewStyle = computed(() => getFloatingButtonPreviewStyle())

const inlineWrapperStyle = 'width:100%;max-width:100%;display:block;clear:both;'
const inlineFrameBaseStyle = 'display:block;width:100%;min-width:100%;max-width:100%;height:0;min-height:0;border:0;overflow:hidden;background:transparent;'
const inlineFrameModalStyle = 'position:fixed;inset:0;z-index:100001;width:100vw;max-width:none;height:100vh;min-height:100vh;border:0;background:transparent;'
const floatingOverlayBaseStyle = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);z-index:99998;opacity:0;transition:opacity 0.3s ease;pointer-events:none;'
const floatingOverlayActiveStyle = `${floatingOverlayBaseStyle}opacity:1;pointer-events:auto;`
const floatingPanelBaseStyle = 'position:fixed;top:0;right:0;bottom:0;width:420px;max-width:100%;z-index:99999;transform:translateX(100%);transition:transform 0.3s ease;'
const floatingPanelMobileStyle = 'position:fixed;top:0;right:0;bottom:0;width:100%;max-width:100%;z-index:99999;transform:translateX(100%);transition:transform 0.3s ease;'
const floatingPanelActiveStyle = 'transform:translateX(0);'
const floatingPanelModalStyle = 'position:fixed;inset:0;width:100vw;max-width:100vw;z-index:99999;transform:none;transition:none;'
const floatingPanelFrameBaseStyle = 'display:block;width:100%;height:100%;background:#fafaf9;box-shadow:-4px 0 20px rgba(0,0,0,0.15);border:0;'
const floatingPanelFrameModalStyle = 'display:block;width:100vw;height:100vh;max-width:none;background:transparent;box-shadow:none;border:0;'
const floatingCloseDesktopStyle = 'position:absolute;top:16px;left:-52px;width:40px;height:40px;background:white;border:0;border-radius:9999px;font-size:24px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:#333;z-index:1;'
const floatingCloseMobileStyle = 'position:absolute;top:16px;right:16px;width:40px;height:40px;background:white;border:0;border-radius:9999px;font-size:24px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:#333;z-index:1;'
const inlineMountId = computed(() => `plai-widget-inline-${(activeOrgId.value || 'mount').replace(/[^\w-]/g, '').slice(0, 12)}`)

const inlineMountCode = computed(() => `<div id="${inlineMountId.value}"></div>`)

const inlineScriptCode = computed(() => {
  const frameSrc = escapeHtml(inlineIframeUrl.value)

  if (!includeStyleBlock.value) {
    return `<script>
  (function () {
    const mount = document.getElementById(${JSON.stringify(inlineMountId.value)})
    if (!mount) return

    const frame = document.createElement('iframe')
    frame.id = 'plai-widget-inline-frame'
    frame.src = ${JSON.stringify(frameSrc)}
    frame.title = 'ProLeadsAI Roof Estimator'
    frame.width = '100%'
    frame.height = '0'
    frame.scrolling = 'no'
    frame.loading = 'lazy'
    frame.referrerPolicy = 'strict-origin-when-cross-origin'
    frame.allow = 'clipboard-write'
    frame.style.cssText = ${JSON.stringify(inlineFrameBaseStyle)}

    mount.innerHTML = ''
    mount.style.cssText = ${JSON.stringify(inlineWrapperStyle)}
    mount.appendChild(frame)

    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow) return

      const data = event.data || {}

      if (data.type === 'proleadsai:availability-changed') {
        const shouldShow = data.widgetEnabled !== false
        mount.style.display = shouldShow ? 'block' : 'none'
        frame.style.height = shouldShow ? (frame.dataset.inlineHeight || frame.style.height || '0px') : '0px'
        frame.style.minHeight = shouldShow ? (frame.dataset.inlineHeight || frame.style.minHeight || '0px') : '0px'
        return
      }

      if (data.type === 'proleadsai:iframe-resize' && data.height) {
        const nextHeight = Math.max(parseInt(data.height, 10) || 0, 0) + 'px'
        frame.dataset.inlineHeight = nextHeight
        frame.style.height = nextHeight
        frame.style.minHeight = nextHeight
        return
      }

      if (data.type === 'proleadsai:modal-open') {
        frame.style.cssText = ${JSON.stringify(inlineFrameModalStyle)}
        document.body.style.overflow = 'hidden'
        return
      }

      if (data.type === 'proleadsai:modal-close') {
        frame.style.cssText = ${JSON.stringify(inlineFrameBaseStyle)}
        const inlineHeight = frame.dataset.inlineHeight || '0px'
        frame.style.height = inlineHeight
        frame.style.minHeight = inlineHeight
        document.body.style.overflow = ''
      }
    })
  })()
<\/script>`
  }

  return `<style>
  .plai-widget-embed {
    width: 100%;
    max-width: 100%;
    display: block;
    clear: both;
  }

  .plai-widget-inline-frame {
    display: block;
    width: 100%;
    min-width: 100%;
    max-width: 100%;
    height: 0;
    min-height: 0;
    border: 0;
    overflow: hidden;
    background: transparent;
  }

  .plai-widget-inline-frame.plai-inline-frame-modal {
    position: fixed !important;
    inset: 0 !important;
    z-index: 100001 !important;
    width: 100vw !important;
    max-width: none !important;
    height: 100vh !important;
    min-height: 100vh !important;
    border: 0 !important;
    background: transparent !important;
  }
</style>

<script>
  (function () {
    const mount = document.getElementById(${JSON.stringify(inlineMountId.value)})
    if (!mount) return

    mount.innerHTML = '<iframe id="plai-widget-inline-frame" class="plai-widget-inline-frame" src="${frameSrc}" title="ProLeadsAI Roof Estimator" width="100%" height="0" scrolling="no" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-write"></iframe>'
    mount.className = 'plai-widget-embed'

    const frame = document.getElementById('plai-widget-inline-frame')
    if (!frame) return

    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow) return

      const data = event.data || {}

      if (data.type === 'proleadsai:availability-changed') {
        const shouldShow = data.widgetEnabled !== false
        mount.style.display = shouldShow ? 'block' : 'none'
        frame.style.height = shouldShow ? frame.style.height : '0px'
        frame.style.minHeight = shouldShow ? frame.style.minHeight : '0px'
        return
      }

      if (data.type === 'proleadsai:iframe-resize' && data.height) {
        const nextHeight = Math.max(parseInt(data.height, 10) || 0, 0)
        frame.style.height = nextHeight + 'px'
        frame.style.minHeight = nextHeight + 'px'
        return
      }

      if (data.type === 'proleadsai:modal-open') {
        frame.classList.add('plai-inline-frame-modal')
        document.body.style.overflow = 'hidden'
        return
      }

      if (data.type === 'proleadsai:modal-close') {
        frame.classList.remove('plai-inline-frame-modal')
        document.body.style.overflow = ''
      }
    })
  })()
<\/script>`
})

const inlineInstallCode = computed(() => `<!-- Place this where the section should appear -->
${inlineMountCode.value}

<!-- Place this near the bottom of the page -->
${inlineScriptCode.value}`)

const floatingScriptCode = computed(() => {
  const buttonStyle = escapeHtml(getFloatingButtonInlineStyle().replace('position:absolute', 'position:fixed'))
  const buttonEmoji = escapeHtml(form.buttonEmoji)
  const buttonText = escapeHtml(form.buttonText)
  const iframeUrlLiteral = JSON.stringify(inlineIframeUrl.value)
  const widgetStatusUrlLiteral = JSON.stringify(widgetStatusUrl.value)

  if (!includeStyleBlock.value) {
    return `<script>
  (function () {
    const iframeUrl = ${iframeUrlLiteral}
    const widgetStatusUrl = ${widgetStatusUrlLiteral}
    const button = document.createElement('button')
    button.id = 'proleadsai-widget-button'
    button.type = 'button'
    button.style.cssText = ${JSON.stringify(buttonStyle)}
    button.innerHTML = '<span>${buttonEmoji}</span><span>${buttonText}</span>'
    document.body.appendChild(button)

    let isOpen = false
    let panelElement = null
    let panelOverlay = null
    let panelFrame = null
    let closeButton = null
    let availabilityChecked = false
    let widgetEnabled = true

    button.addEventListener('click', openPanel)
    bindIframeEvents()
    syncWidgetAvailability()

    function getPanelBaseStyle() {
      return window.innerWidth <= 480
        ? ${JSON.stringify(floatingPanelMobileStyle)}
        : ${JSON.stringify(floatingPanelBaseStyle)}
    }

    function getCloseButtonStyle() {
      return window.innerWidth <= 480
        ? ${JSON.stringify(floatingCloseMobileStyle)}
        : ${JSON.stringify(floatingCloseDesktopStyle)}
    }

    function setFloatingButtonVisibility(shouldShow) {
      widgetEnabled = shouldShow !== false
      button.style.display = widgetEnabled ? 'flex' : 'none'
    }

    async function syncWidgetAvailability() {
      setFloatingButtonVisibility(false)

      try {
        const response = await fetch(widgetStatusUrl, {
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          throw new Error('Availability check failed')
        }

        const data = await response.json()
        availabilityChecked = true
        setFloatingButtonVisibility(data.widgetEnabled !== false)
      } catch (error) {
        availabilityChecked = true
        setFloatingButtonVisibility(false)
      }
    }

    function bindIframeEvents() {
      window.addEventListener('message', function (event) {
        const data = event.data || {}

        if (!panelFrame || event.source !== panelFrame.contentWindow) {
          return
        }

        if (data.type === 'proleadsai:availability-changed') {
          setFloatingButtonVisibility(data.widgetEnabled !== false)
          if (data.widgetEnabled === false) {
            closePanel()
          }
          return
        }

        if (data.type === 'proleadsai:modal-open') {
          panelElement.style.cssText = ${JSON.stringify(floatingPanelModalStyle)}
          panelFrame.style.cssText = ${JSON.stringify(floatingPanelFrameModalStyle)}
          if (panelOverlay) panelOverlay.style.display = 'none'
          if (closeButton) closeButton.style.display = 'none'
          return
        }

        if (data.type === 'proleadsai:modal-close') {
          panelElement.style.cssText = getPanelBaseStyle() + ${JSON.stringify(floatingPanelActiveStyle)}
          panelFrame.style.cssText = ${JSON.stringify(floatingPanelFrameBaseStyle)}
          if (panelOverlay) panelOverlay.style.cssText = ${JSON.stringify(floatingOverlayActiveStyle)}
          if (closeButton) closeButton.style.cssText = getCloseButtonStyle()
        }
      })
    }

    function openPanel() {
      if (!availabilityChecked || !widgetEnabled || isOpen) {
        return
      }

      isOpen = true

      panelOverlay = document.createElement('div')
      panelOverlay.style.cssText = ${JSON.stringify(floatingOverlayBaseStyle)}
      panelOverlay.addEventListener('click', closePanel)
      document.body.appendChild(panelOverlay)

      panelElement = document.createElement('div')
      panelElement.style.cssText = getPanelBaseStyle()

      closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.innerHTML = '&times;'
      closeButton.setAttribute('aria-label', 'Close panel')
      closeButton.style.cssText = getCloseButtonStyle()
      closeButton.addEventListener('click', closePanel)

      panelFrame = document.createElement('iframe')
      panelFrame.src = iframeUrl
      panelFrame.title = 'ProLeadsAI Roof Estimator'
      panelFrame.loading = 'lazy'
      panelFrame.referrerPolicy = 'strict-origin-when-cross-origin'
      panelFrame.allow = 'clipboard-write'
      panelFrame.style.cssText = ${JSON.stringify(floatingPanelFrameBaseStyle)}

      panelElement.appendChild(closeButton)
      panelElement.appendChild(panelFrame)
      document.body.appendChild(panelElement)
      document.body.style.overflow = 'hidden'

      requestAnimationFrame(function () {
        panelOverlay.style.cssText = ${JSON.stringify(floatingOverlayActiveStyle)}
        panelElement.style.cssText = getPanelBaseStyle() + ${JSON.stringify(floatingPanelActiveStyle)}
      })
    }

    function closePanel() {
      if (!isOpen) {
        return
      }

      if (panelOverlay) panelOverlay.style.cssText = ${JSON.stringify(floatingOverlayBaseStyle)}
      if (panelElement) panelElement.style.cssText = getPanelBaseStyle()

      setTimeout(function () {
        if (panelOverlay) panelOverlay.remove()
        if (panelElement) panelElement.remove()
        panelOverlay = null
        panelElement = null
        panelFrame = null
        closeButton = null
        document.body.style.overflow = ''
        isOpen = false
        syncWidgetAvailability()
      }, 300)
    }
  })()
<\/script>`
  }

  return `<style>
  .plai-panel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 99998;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .plai-panel-overlay.active {
    opacity: 1;
    pointer-events: auto;
  }

  .plai-panel-container {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 420px;
    max-width: 100%;
    z-index: 99999;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }

  .plai-panel-container.active {
    transform: translateX(0);
  }

  .plai-panel-close {
    position: absolute;
    top: 16px;
    left: -52px;
    width: 40px;
    height: 40px;
    background: white;
    border: 0;
    border-radius: 9999px;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
    z-index: 1;
  }

  .plai-panel-frame {
    display: block;
    width: 100%;
    height: 100%;
    background: #fafaf9;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    border: 0;
  }

  .plai-panel-container.plai-modal-host-active {
    inset: 0;
    width: 100vw;
    max-width: 100vw;
    transform: none !important;
  }

  .plai-panel-container.plai-modal-host-active .plai-panel-frame {
    width: 100vw;
    height: 100vh;
    max-width: none;
    box-shadow: none;
    background: transparent;
  }

  .plai-panel-container.plai-modal-host-active .plai-panel-close,
  .plai-panel-overlay.plai-modal-host-active {
    display: none;
  }

  @media (max-width: 480px) {
    .plai-panel-container {
      width: 100%;
    }

    .plai-panel-close {
      left: auto;
      right: 16px;
      top: 16px;
    }
  }
</style>

<script>
  (function () {
    const iframeUrl = ${iframeUrlLiteral}
    const widgetStatusUrl = ${widgetStatusUrlLiteral}
    const button = document.createElement('button')
    button.id = 'proleadsai-widget-button'
    button.type = 'button'
    button.style.cssText = ${JSON.stringify(buttonStyle)}
    button.innerHTML = '<span>${buttonEmoji}</span><span>${buttonText}</span>'
    document.body.appendChild(button)

    let isOpen = false
    let panelElement = null
    let panelOverlay = null
    let activeModalFrame = null
    let availabilityChecked = false
    let widgetEnabled = true

    button.addEventListener('click', openPanel)
    bindIframeEvents()
    syncWidgetAvailability()

    function setFloatingButtonVisibility(shouldShow) {
      widgetEnabled = shouldShow !== false
      button.style.display = widgetEnabled ? 'flex' : 'none'
    }

    async function syncWidgetAvailability() {
      setFloatingButtonVisibility(false)

      try {
        const response = await fetch(widgetStatusUrl, {
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          throw new Error('Availability check failed')
        }

        const data = await response.json()
        availabilityChecked = true
        setFloatingButtonVisibility(data.widgetEnabled !== false)
      } catch (error) {
        availabilityChecked = true
        setFloatingButtonVisibility(false)
      }
    }

    function bindIframeEvents() {
      window.addEventListener('message', function (event) {
        const data = event.data || {}
        const panelFrame = panelElement ? panelElement.querySelector('.plai-panel-frame') : null

        if (!panelFrame || event.source !== panelFrame.contentWindow) {
          return
        }

        if (data.type === 'proleadsai:availability-changed') {
          setFloatingButtonVisibility(data.widgetEnabled !== false)
          if (data.widgetEnabled === false) {
            closePanel()
          }
          return
        }

        if (data.type === 'proleadsai:modal-open') {
          activeModalFrame = panelFrame
          panelElement.classList.add('plai-modal-host-active')
          if (panelOverlay) {
            panelOverlay.classList.add('plai-modal-host-active')
          }
          return
        }

        if (data.type === 'proleadsai:modal-close') {
          activeModalFrame = null
          panelElement.classList.remove('plai-modal-host-active')
          if (panelOverlay) {
            panelOverlay.classList.remove('plai-modal-host-active')
          }
        }
      })
    }

    function openPanel() {
      if (!availabilityChecked || !widgetEnabled || isOpen) {
        return
      }

      isOpen = true

      panelOverlay = document.createElement('div')
      panelOverlay.className = 'plai-panel-overlay'
      panelOverlay.addEventListener('click', closePanel)
      document.body.appendChild(panelOverlay)

      panelElement = document.createElement('div')
      panelElement.className = 'plai-panel-container'
      panelElement.innerHTML = [
        '<button class="plai-panel-close" type="button">&times;</button>',
        '<iframe class="plai-panel-frame" src="' + iframeUrl + '" title="ProLeadsAI Roof Estimator" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-write"></iframe>'
      ].join('')

      document.body.appendChild(panelElement)
      panelElement.querySelector('.plai-panel-close').addEventListener('click', closePanel)
      document.body.style.overflow = 'hidden'

      requestAnimationFrame(function () {
        panelOverlay.classList.add('active')
        panelElement.classList.add('active')
      })
    }

    function closePanel() {
      if (!isOpen) {
        return
      }

      activeModalFrame = null
      if (panelOverlay) panelOverlay.classList.remove('active')
      if (panelElement) panelElement.classList.remove('active')

      setTimeout(function () {
        if (panelOverlay) panelOverlay.remove()
        if (panelElement) panelElement.remove()
        panelOverlay = null
        panelElement = null
        document.body.style.overflow = ''
        isOpen = false
        syncWidgetAvailability()
      }, 300)
    }
  })()
<\/script>`
})

const floatingInstallCode = computed(() => `<!-- Place this near the bottom of the page -->
${floatingScriptCode.value}`)

const currentInstallCode = computed(() => installMode.value === 'inline' ? inlineInstallCode.value : floatingInstallCode.value)
const currentIframeUrl = computed(() => inlineIframeUrl.value)
const currentInstallLabel = computed(() => installMode.value === 'inline' ? 'Install snippets' : 'Floating script')
const placementInstruction = computed(() => installMode.value === 'inline'
  ? 'Add the small HTML hook where the section should appear, then paste the page script near the bottom of the page.'
  : 'Paste the script near the bottom of the page so the floating launcher is available site-wide.')
const previewFrameHeightClass = computed(() => installMode.value === 'inline' ? 'h-[520px]' : 'h-[560px]')

const previewBackgroundStyle = computed(() => {
  if (form.bgStyle === 'custom') {
    return { backgroundColor: form.bgColor }
  }
  if (form.bgStyle === 'dark') {
    return {
      background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
      color: '#f5f5f4'
    }
  }
  if (form.bgStyle === 'light') {
    return {
      background: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)'
    }
  }
  return {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)'
  }
})

const previewHeadingStyle = computed(() => ({
  color: form.headingColor,
  fontFamily: form.headingFont || undefined,
  fontSize: form.headingSize || undefined
}))

const previewTextStyle = computed(() => ({
  color: form.textColorShortcode,
  fontFamily: form.textFont || undefined,
  fontSize: form.textSize || undefined
}))

const previewHostStyle = computed(() => ({
  background: 'radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 28%), linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)'
}))

const instructionsList = computed(() => {
  if (installMode.value === 'inline') {
    return [
      'Paste the HTML hook exactly where the widget section should appear.',
      'Paste the page script near the bottom of the page, usually right before the closing </body> tag.',
      'Publish the page and confirm the widget loads into that section. The snippet already includes what it needs.'
    ]
  }

  return [
    'Paste the script near the bottom of the page where site-wide scripts usually go.',
    'Publish the page and verify the button appears and opens the slide-out panel.',
    'The snippet already includes what it needs, so there is no separate setup step.'
  ]
})

async function copyValue(value: string, label: string) {
  await copy(value)
  toast.add({ title: `${label} copied`, color: 'success' })
}

function openPreview() {
  if (!import.meta.client)
    return

  const previewUrl = installMode.value === 'floating' ? floatingIframeUrl.value : inlineIframeUrl.value
  window.open(previewUrl, '_blank', 'noopener,noreferrer')
}

function resetEmailModal() {
  emailModalOpen.value = false
  sendingEmail.value = false
  emailForm.recipientEmail = ''
}

async function sendInstallEmail() {
  if (!activeOrgId.value)
    return

  if (!emailForm.recipientEmail.trim()) {
    toast.add({ title: 'Recipient email is required', color: 'error' })
    return
  }

  sendingEmail.value = true
  try {
    await $fetch(`/api/organization/${activeOrgId.value}/install/email`, {
      method: 'POST',
      body: {
        recipientEmail: emailForm.recipientEmail,
        organizationName: activeOrgName.value,
        installMode: installMode.value,
        iframeUrl: currentIframeUrl.value,
        installCode: currentInstallCode.value,
        placementInstruction: placementInstruction.value
      }
    })

    toast.add({ title: 'Install instructions emailed', color: 'success' })
    resetEmailModal()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || error?.data?.statusMessage || 'Failed to send install instructions',
      color: 'error'
    })
  } finally {
    sendingEmail.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
    <UCard>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-3xl space-y-2">
          <div class="inline-flex rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-200">
            Install Builder
          </div>
          <h1 class="text-3xl font-semibold tracking-tight">
            Install the ProLeadsAI widget
          </h1>
          <p class="text-sm text-neutral-500">
            Configure the live preview first, then copy the exact code your developer needs. The install guidance lives in a modal, and you can email the setup directly to a developer from here.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-book-open"
            :disabled="!activeOrgId"
            @click="instructionsModalOpen = true"
          >
            Install instructions
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-mail"
            :disabled="!activeOrgId"
            @click="emailModalOpen = true"
          >
            Email developer
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-external-link"
            :disabled="!activeOrgId"
            @click="openPreview"
          >
            Open preview
          </UButton>
          <UButton
            icon="i-lucide-copy"
            :disabled="!activeOrgId"
            @click="copyValue(currentInstallCode, currentInstallLabel)"
          >
            Copy code
          </UButton>
        </div>
      </div>
    </UCard>

    <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p class="leading-6">
          <strong>Using WordPress?</strong>
          Install the WordPress plugin and all your config will be within the WordPress plugin settings.
        </p>
        <UButton
          to="https://wordpress.org/plugins/proleadsai/"
          target="_blank"
          color="neutral"
          variant="solid"
          trailing-icon="i-lucide-external-link"
        >
          WordPress plugin
        </UButton>
      </div>
    </div>

    <div
      v-if="!activeOrgId"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      No active organization is loaded yet, so install code cannot be generated.
    </div>

    <div
      v-else
      class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
    >
      <div class="flex flex-col gap-6">
        <UCard>
          <div class="space-y-6">
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div class="inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button
                    v-for="mode in installModes"
                    :key="mode.id"
                    type="button"
                    class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    :class="installMode === mode.id
                      ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white'
                      : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'"
                    @click="installMode = mode.id"
                  >
                    {{ mode.label }}
                  </button>
                </div>
                <p class="mt-3 text-sm text-neutral-500">
                  {{ installModes.find(mode => mode.id === installMode)?.description }}
                </p>
              </div>

              <div class="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                {{ placementInstruction }}
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <UFormField label="Heading">
                <UInput v-model="form.heading" />
              </UFormField>

              <UFormField label="Subheading">
                <UInput v-model="form.subheading" />
              </UFormField>

              <UFormField label="Primary color">
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.primaryColor"
                    type="color"
                    class="h-10 w-14 rounded border border-neutral-200 bg-transparent p-1 dark:border-neutral-700"
                  >
                  <UInput
                    v-model="form.primaryColor"
                    class="flex-1"
                  />
                </div>
              </UFormField>

              <UFormField label="Body text color">
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.textColorShortcode"
                    type="color"
                    class="h-10 w-14 rounded border border-neutral-200 bg-transparent p-1 dark:border-neutral-700"
                  >
                  <UInput
                    v-model="form.textColorShortcode"
                    class="flex-1"
                  />
                </div>
              </UFormField>

              <UFormField label="Heading font">
                <USelect
                  v-model="headingFontModel"
                  :items="fontOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Body font">
                <USelect
                  v-model="textFontModel"
                  :items="fontOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Heading color">
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.headingColor"
                    type="color"
                    class="h-10 w-14 rounded border border-neutral-200 bg-transparent p-1 dark:border-neutral-700"
                  >
                  <UInput
                    v-model="form.headingColor"
                    class="flex-1"
                  />
                </div>
              </UFormField>

              <UFormField label="Background style">
                <USelect
                  v-model="form.bgStyle"
                  :items="backgroundStyleOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="form.bgStyle === 'custom'"
                label="Background color"
              >
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.bgColor"
                    type="color"
                    class="h-10 w-14 rounded border border-neutral-200 bg-transparent p-1 dark:border-neutral-700"
                  >
                  <UInput
                    v-model="form.bgColor"
                    class="flex-1"
                  />
                </div>
              </UFormField>

              <UFormField label="Hero image">
                <USelect
                  v-model="form.heroImageMode"
                  :items="heroImageOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="form.heroImageMode === 'custom'"
                label="Hero image URL"
                class="md:col-span-2"
              >
                <UInput
                  v-model="form.heroImageUrl"
                  placeholder="https://cdn.example.com/widget-image.jpg"
                />
              </UFormField>

              <UFormField label="Heading size override">
                <UInput
                  v-model="form.headingSize"
                  placeholder="2.75rem"
                />
              </UFormField>

              <UFormField label="Text size override">
                <UInput
                  v-model="form.textSize"
                  placeholder="1rem"
                />
              </UFormField>
            </div>

            <div
              v-if="installMode === 'floating'"
              class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <div class="mb-4">
                <h2 class="text-base font-semibold">
                  Floating button settings
                </h2>
                <p class="mt-1 text-sm text-neutral-500">
                  The launcher sits on the page itself, and the panel opens the same widget preview shown here.
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <UFormField label="Button text">
                  <UInput v-model="form.buttonText" />
                </UFormField>

                <UFormField label="Button emoji">
                  <UInput v-model="form.buttonEmoji" />
                </UFormField>

                <UFormField label="Button text color">
                  <div class="flex items-center gap-3">
                    <input
                      v-model="form.textColor"
                      type="color"
                      class="h-10 w-14 rounded border border-neutral-200 bg-transparent p-1 dark:border-neutral-700"
                    >
                    <UInput
                      v-model="form.textColor"
                      class="flex-1"
                    />
                  </div>
                </UFormField>

                <UFormField label="Button position">
                  <USelect
                    v-model="form.buttonPosition"
                    :items="buttonPositionOptions"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <label class="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <UCheckbox v-model="form.disableWhenUnavailable" />
              <span class="text-neutral-600 dark:text-neutral-300">
                Hide the widget when the organization runs out of credits.
              </span>
            </label>

            <label class="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <UCheckbox v-model="includeStyleBlock" />
              <span class="text-neutral-600 dark:text-neutral-300">
                Include a separate <code>&lt;style&gt;</code> block in the install snippet. Leave this off to keep everything inline in one snippet.
              </span>
            </label>
          </div>
        </UCard>
      </div>

      <div class="flex flex-col gap-6">
        <UCard class="overflow-hidden xl:sticky xl:top-24">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">
                  Live preview
                </h2>
                <p class="mt-1 text-sm text-neutral-500">
                  This reflects the current configuration for {{ activeOrgName }}.
                </p>
              </div>
              <UBadge
                color="neutral"
                variant="outline"
              >
                {{ installMode === 'inline' ? 'Inline' : 'Floating' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div
              class="mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] border border-neutral-200 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] dark:border-neutral-800"
              :style="previewHostStyle"
            >
              <div class="mb-4 flex items-center gap-2">
                <span class="h-3 w-3 rounded-full bg-rose-400" />
                <span class="h-3 w-3 rounded-full bg-amber-400" />
                <span class="h-3 w-3 rounded-full bg-emerald-400" />
                <div class="ml-2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-neutral-500 shadow-sm">
                  preview-host.example
                </div>
              </div>

              <div
                class="relative overflow-hidden rounded-[22px] border border-white/70 bg-white/70 backdrop-blur"
                :class="previewFrameHeightClass"
              >
                <template v-if="installMode === 'inline'">
                  <iframe
                    class="block w-full rounded-[22px] border-0 bg-white"
                    :class="previewFrameHeightClass"
                    :src="inlineIframeUrl"
                    title="Inline widget preview"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="clipboard-write"
                  />
                </template>

                <template v-else>
                  <div
                    class="relative overflow-hidden rounded-[22px] p-5"
                    :class="previewFrameHeightClass"
                    :style="previewBackgroundStyle"
                  >
                    <div class="max-w-md space-y-3">
                      <div
                        class="inline-flex rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600 shadow-sm"
                      >
                        Preview page
                      </div>
                      <h3
                        class="text-3xl font-bold tracking-tight"
                        :style="previewHeadingStyle"
                      >
                        {{ form.heading }}
                      </h3>
                      <p
                        class="max-w-sm text-sm leading-6"
                        :style="previewTextStyle"
                      >
                        {{ form.subheading }}
                      </p>
                    </div>

                    <button
                      type="button"
                      :style="floatingButtonPreviewStyle"
                      @click="floatingPreviewOpen = !floatingPreviewOpen"
                    >
                      <span>{{ form.buttonEmoji }}</span>
                      <span>{{ form.buttonText }}</span>
                    </button>

                    <Transition name="fade">
                      <div
                        v-if="floatingPreviewOpen"
                        class="absolute inset-0 z-20 bg-black/35 backdrop-blur-[2px]"
                        @click="floatingPreviewOpen = false"
                      />
                    </Transition>

                    <Transition name="slide-panel">
                      <div
                        v-if="floatingPreviewOpen"
                        class="absolute inset-y-0 right-0 z-30 w-full max-w-[320px] border-l border-neutral-200 bg-stone-50 shadow-[-24px_0_60px_rgba(15,23,42,0.2)]"
                      >
                        <button
                          type="button"
                          class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-lg"
                          @click="floatingPreviewOpen = false"
                        >
                          <UIcon
                            name="i-lucide-x"
                            class="h-5 w-5"
                          />
                        </button>
                        <iframe
                          class="block h-full w-full border-0 bg-white"
                          :src="inlineIframeUrl"
                          title="Floating widget panel preview"
                          loading="lazy"
                          referrerpolicy="strict-origin-when-cross-origin"
                          allow="clipboard-write"
                        />
                      </div>
                    </Transition>
                  </div>
                </template>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Placement
                </div>
                <p class="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                  {{ installMode === 'inline' ? 'Place it where the section should appear.' : 'Place it near the bottom of the page.' }}
                </p>
              </div>
              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Delivery
                </div>
                <p class="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                  Copy the code or email it to a developer.
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <UModal
      v-model:open="instructionsModalOpen"
      title="Install instructions"
      description="Use this when handing off the widget embed to a developer."
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-6xl' }"
    >
      <template #body>
        <div class="space-y-5">
          <div class="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-100">
            {{ placementInstruction }}
          </div>

          <ol class="space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
            <li
              v-for="(step, index) in instructionsList"
              :key="step"
              class="flex gap-3"
            >
              <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                {{ index + 1 }}
              </span>
              <span>{{ step }}</span>
            </li>
          </ol>

          <div
            v-if="installMode === 'inline'"
            class="grid gap-4 lg:grid-cols-2"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-medium">
                  Section HTML hook
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-copy"
                  @click="copyValue(inlineMountCode, 'Section HTML hook')"
                >
                  Copy hook
                </UButton>
              </div>
              <UTextarea
                :model-value="inlineMountCode"
                :rows="5"
                class="w-full"
                readonly
                autoresize
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-medium">
                  Page script
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-copy"
                  @click="copyValue(inlineScriptCode, 'Page script')"
                >
                  Copy script
                </UButton>
              </div>
              <UTextarea
                :model-value="inlineScriptCode"
                :rows="16"
                class="w-full"
                readonly
                autoresize
              />
            </div>
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-medium">
                Page script
              </div>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-copy"
                @click="copyValue(floatingScriptCode, 'Floating script')"
              >
                Copy script
              </UButton>
            </div>
            <UTextarea
              :model-value="floatingScriptCode"
              :rows="18"
              class="w-full"
              readonly
              autoresize
            />
          </div>
        </div>
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="instructionsModalOpen = false"
        >
          Close
        </UButton>
        <UButton
          icon="i-lucide-copy"
          @click="copyValue(currentInstallCode, currentInstallLabel)"
        >
          Copy code
        </UButton>
      </template>
    </UModal>

    <UModal
      v-model:open="emailModalOpen"
      title="Email install instructions"
      description="Send the current configuration to a developer or site manager."
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-4xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Recipient email">
            <UInput
              v-model="emailForm.recipientEmail"
              type="email"
              placeholder="jane@example.com"
            />
          </UFormField>

          <div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            They’ll receive the current install code, a short setup note, and simple placement instructions. Everything needed, including the styling, is already inside the snippet.
          </div>
        </div>
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="sendingEmail"
          @click="resetEmailModal"
        >
          Cancel
        </UButton>
        <UButton
          icon="i-lucide-send"
          :loading="sendingEmail"
          @click="sendInstallEmail"
        >
          Send instructions
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s ease;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
}
</style>
