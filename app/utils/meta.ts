declare global {
  interface Window {
    fbq: (...args: any[]) => void
  }
}

export const trackCompleteRegistration = (eventId: string) => {
  if (import.meta.client && typeof window.fbq === 'function') {
    window.fbq('track', 'CompleteRegistration', {
      content_name: 'account_confirmation',
      status: 'confirmed'
    }, {
      eventID: eventId
    })
  }
}
