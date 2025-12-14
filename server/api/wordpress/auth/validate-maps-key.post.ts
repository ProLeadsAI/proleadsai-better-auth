import { createError, defineEventHandler, readBody, setResponseHeaders } from 'h3'

/**
 * Validate Google Maps API Key - specifically tests Solar API server-side
 *
 * The Maps JavaScript API and Places API (New) are validated client-side in the WordPress admin.
 * This endpoint validates the Solar API which requires server-side testing.
 */
export default defineEventHandler(async (event) => {
  // Handle CORS
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    return { ok: true }
  }

  const body = await readBody(event)
  const apiKey = (body?.apiKey || body?.googleMapsApiKey || '').toString().trim()

  if (!apiKey) {
    throw createError({ statusCode: 400, message: 'API key is required' })
  }

  // Test Solar API
  const solarResult = await testSolarApi(apiKey)

  return {
    success: solarResult.valid,
    solarApi: solarResult
  }
})

/**
 * Test Solar API by making a real request to the buildingInsights endpoint
 * Uses the same approach as getRoofDataFromSolar in roofCalculations.ts
 */
async function testSolarApi(apiKey: string): Promise<{ valid: boolean, message: string }> {
  try {
    // Use Google's headquarters as a test location (known to have solar data)
    const testLat = 37.4220
    const testLng = -122.0841

    const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${testLat}&location.longitude=${testLng}&requiredQuality=HIGH&key=${apiKey}`

    const response = await fetch(solarApiUrl)

    if (response.ok) {
      const data = await response.json()
      if (data.solarPotential) {
        return { valid: true, message: 'Solar API working correctly' }
      }
      // Response OK but no solar data - API is still working
      return { valid: true, message: 'Solar API responding (limited data for test location)' }
    }

    // Handle error response
    const errorText = await response.text()
    let errorData: any = {}
    try {
      errorData = JSON.parse(errorText)
    } catch {
      // Not JSON, use raw text
    }

    const errorMessage = errorData.error?.message || errorText || ''
    const errorCode = errorData.error?.code || response.status
    const errorStatus = errorData.error?.status || ''

    // Check for referrer restriction error
    if (errorMessage.toLowerCase().includes('referer') || errorMessage.toLowerCase().includes('referrer')) {
      return {
        valid: false,
        message: 'Solar API requires "None" application restriction (not HTTP referrers). Edit your API key in Google Cloud Console.'
      }
    }

    // Check for API not enabled
    if (errorMessage.toLowerCase().includes('not enabled') || errorMessage.toLowerCase().includes('solar api has not been used')) {
      return { valid: false, message: 'Solar API is not enabled. Enable it in Google Cloud Console.' }
    }

    // Check for invalid API key
    if (errorMessage.toLowerCase().includes('api key') && errorMessage.toLowerCase().includes('invalid')) {
      return { valid: false, message: 'Invalid API key for Solar API' }
    }

    // Permission denied
    if (errorCode === 403 || errorStatus === 'PERMISSION_DENIED') {
      return { valid: false, message: errorMessage || 'Permission denied - check API key and Solar API is enabled' }
    }

    // Quota exceeded
    if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
      return { valid: false, message: 'Solar API quota exceeded. Check your billing.' }
    }

    // Generic error
    return { valid: false, message: `Solar API error (${response.status}): ${errorMessage || 'Unknown error'}` }
  } catch (e: any) {
    return { valid: false, message: e.message || 'Failed to test Solar API' }
  }
}
