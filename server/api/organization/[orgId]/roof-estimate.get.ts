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

  const lat = query.lat ? Number(query.lat) : null
  const lng = query.lng ? Number(query.lng) : null
  const address = query.address as string | undefined
  const sessionId = (query.sessionId as string) || `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  // toolSessionId groups searches in a flow - use provided or generate new
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

  // Use org's API key for WordPress sources, fall back to server key for other sources
  const config = useRuntimeConfig()
  const apiKey = org.googleMapsApiKey || config.googleMapsApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: org.source === 'wordpress'
        ? 'Google Maps API key not configured for this organization. Please add your API key in WordPress settings.'
        : 'Google Maps API key not configured'
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

    // Geocode if needed
    if (lat !== null && lng !== null) {
      coordinates = { lat, lng }
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      const geocodeRes = await fetch(geocodeUrl)
      const geocodeJson = await geocodeRes.json()
      if (geocodeJson.status === 'OK') {
        formattedAddress = geocodeJson.results[0]?.formatted_address || formattedAddress
        const components = geocodeJson.results[0]?.address_components || []
        decodedAddress = decodeAddressFromGeocode(components)
      }
    } else {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address!)}&key=${apiKey}`
      const geocodeRes = await fetch(geocodeUrl)
      const geocodeJson = await geocodeRes.json()
      if (geocodeJson.status === 'OK') {
        coordinates = geocodeJson.results[0].geometry.location
        formattedAddress = geocodeJson.results[0]?.formatted_address || formattedAddress
        const components = geocodeJson.results[0]?.address_components || []
        decodedAddress = decodeAddressFromGeocode(components)
      } else {
        throw createError({ statusCode: 400, message: 'Failed to geocode address' })
      }
    }

    // Get roof data from Solar API
    const solarData = await getRoofDataFromSolar(coordinates!, apiKey)
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
