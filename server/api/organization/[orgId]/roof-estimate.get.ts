import { and, eq } from 'drizzle-orm'
import { addresses, leads, organization as organizationTable } from '~~/server/db/schema'
import { useDB } from '~~/server/utils/db'
import { decodeAddressFromGeocode } from '~~/server/utils/decodeAddressFromGeocode'
import {
  calculateRoofArea,
  calculateRoofEstimate,
  categorizeRoofPitch,
  extractRoofOutlinePoints,
  getRoofDataFromSolar
} from '~~/server/utils/roofCalculations'

export default defineEventHandler(async (event) => {
  // Set CORS headers
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  })

  // Handle preflight
  if (getMethod(event) === 'OPTIONS') {
    return null
  }

  const query = getQuery(event)
  const orgId = getRouterParam(event, 'orgId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const db = await useDB(event)

  const lat = query.lat ? Number.parseFloat(query.lat as string) : null
  const lng = query.lng ? Number.parseFloat(query.lng as string) : null
  const address = query.address as string | undefined
  const streetAddress = query.streetAddress as string | undefined
  const addressLocality = query.addressLocality as string | undefined
  const addressRegion = query.addressRegion as string | undefined
  const postalCode = query.postalCode as string | undefined
  const addressCountry = query.addressCountry as string | undefined
  const sessionId = (query.sessionId as string) || `roof_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  const toolSessionId = (query.toolSessionId as string) || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  if (!address && (lat === null || lng === null)) {
    throw createError({
      statusCode: 400,
      message: 'Missing required parameters: lat/lng or address'
    })
  }

  // Get organization settings (including their Google Maps API key)
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, orgId)
  })

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Use org's API keys for WordPress sources, fall back to server key for other sources
  const config = useRuntimeConfig()
  const mapsApiKey = org.googleMapsApiKey || config.googleMapsApiKey
  const solarApiKey = org.googleSolarApiKey || config.googleMapsApiKey

  if (!mapsApiKey) {
    throw createError({
      statusCode: 500,
      message: org.source === 'wordpress'
        ? 'Google Maps API key not configured for this organization. Please add your API key in WordPress settings.'
        : 'Google Maps API key not configured'
    })
  }

  if (!solarApiKey) {
    throw createError({
      statusCode: 500,
      message: org.source === 'wordpress'
        ? 'Google Solar API key not configured for this organization. Please add your API key in WordPress settings.'
        : 'Google Solar API key not configured'
    })
  }

  const pricePerSq = org.pricePerSq ?? 350

  try {
    let coordinates: { lat: number, lng: number }
    let formattedAddress = 'Unknown Location'
    let decodedAddress = {
      streetAddress: '',
      streetAddress2: '',
      postOfficeBoxNumber: '',
      addressLocality: '',
      addressRegion: '',
      postalCode: '',
      addressCountry: ''
    }

    // Use address components from frontend if provided, otherwise geocode
    if (lat !== null && lng !== null) {
      coordinates = { lat, lng }

      // If frontend sent address components, use them directly (no geocoding needed)
      if (streetAddress || addressLocality || addressRegion) {
        decodedAddress = {
          streetAddress: streetAddress || '',
          streetAddress2: '',
          postOfficeBoxNumber: '',
          addressLocality: addressLocality || '',
          addressRegion: addressRegion || '',
          postalCode: postalCode || '',
          addressCountry: addressCountry || ''
        }
        formattedAddress = [streetAddress, addressLocality, addressRegion, postalCode].filter(Boolean).join(', ')
        console.log('[roof-estimate] Using address from frontend:', decodedAddress)
      } else {
        // Fallback to reverse geocoding if no address components provided
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${solarApiKey}`
        const geocodeRes = await fetch(geocodeUrl)
        const geocodeJson = await geocodeRes.json()
        console.log('[roof-estimate] Geocode response status:', geocodeJson.status, geocodeJson.error_message || '')
        if (geocodeJson.status === 'OK') {
          formattedAddress = geocodeJson.results[0]?.formatted_address || formattedAddress
          const components = geocodeJson.results[0]?.address_components || []
          decodedAddress = decodeAddressFromGeocode(components)
          console.log('[roof-estimate] Decoded address:', decodedAddress)
        }
      }
    } else {
      // Address-based lookup (no lat/lng) - must geocode
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address!)}&key=${solarApiKey}`
      const geocodeRes = await fetch(geocodeUrl)
      const geocodeJson = await geocodeRes.json()
      console.log('[roof-estimate] Geocode (address) response status:', geocodeJson.status, geocodeJson.error_message || '')
      if (geocodeJson.status === 'OK') {
        coordinates = geocodeJson.results[0].geometry.location
        formattedAddress = geocodeJson.results[0]?.formatted_address || formattedAddress
        const components = geocodeJson.results[0]?.address_components || []
        decodedAddress = decodeAddressFromGeocode(components)
        console.log('[roof-estimate] Decoded address:', decodedAddress)
      } else {
        throw createError({ statusCode: 400, message: 'Failed to geocode address' })
      }
    }

    // Get roof data from Solar API
    const solarData = await getRoofDataFromSolar(coordinates!, solarApiKey)
    if (!solarData?.solarPotential?.roofSegmentStats) {
      throw createError({ statusCode: 404, message: 'Could not retrieve roof data' })
    }

    const totalRoofArea = calculateRoofArea(solarData)
    const estimate = calculateRoofEstimate(totalRoofArea, pricePerSq)
    const roofOutlinePoints = extractRoofOutlinePoints(solarData.solarPotential.roofSegmentStats)
    const roofPitchInfo = categorizeRoofPitch(solarData.solarPotential.roofSegmentStats)

    // Check for existing lead with this toolSessionId (groups searches in a flow)
    const existingLead = await db.query.leads.findFirst({
      where: and(
        eq(leads.toolSessionId, toolSessionId),
        eq(leads.organizationId, orgId)
      )
    })

    let leadId: string
    if (existingLead) {
      leadId = existingLead.id
    } else {
      const [newLead] = await db.insert(leads).values({
        organizationId: orgId,
        name: 'Roof Estimate Search',
        email: null,
        phone: null,
        labels: ['roof-estimate-search'],
        metadata: {},
        sessionId,
        toolSessionId
      }).returning()
      leadId = newLead.id
    }

    // Create address record with roof data
    await db.insert(addresses).values({
      organizationId: orgId,
      leadId,
      streetAddress: decodedAddress.streetAddress,
      streetAddress2: decodedAddress.streetAddress2 || null,
      postOfficeBoxNumber: decodedAddress.postOfficeBoxNumber || null,
      addressLocality: decodedAddress.addressLocality,
      addressRegion: decodedAddress.addressRegion,
      postalCode: decodedAddress.postalCode,
      addressCountry: decodedAddress.addressCountry || null,
      latitude: String(coordinates!.lat),
      longitude: String(coordinates!.lng),
      source: 'searched',
      roofAreaSqFt: Math.round(totalRoofArea),
      pricePerSquare: pricePerSq,
      estimate,
      predominantPitchType: roofPitchInfo.predominantPitchType,
      roofOutlinePoints
    })

    const { segments, ...restPitch } = roofPitchInfo

    return {
      address: formattedAddress,
      coordinates: coordinates!,
      roofAreaSqFt: Math.round(totalRoofArea),
      roofSquares: Math.ceil(totalRoofArea / 100),
      pricePerSquare: pricePerSq,
      estimate,
      roofOutlinePoints,
      roofPitch: restPitch,
      sessionId,
      toolSessionId,
      success: true
    }
  } catch (error: any) {
    console.error('GET roof estimate error:', error)
    return {
      error: true,
      sessionId,
      toolSessionId,
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to get roof estimate'
    }
  }
})
