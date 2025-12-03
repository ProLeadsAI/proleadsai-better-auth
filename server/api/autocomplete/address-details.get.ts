export default defineEventHandler(async (event) => {
  const { place_id } = getQuery(event)

  if (!place_id || typeof place_id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid query parameter: place_id'
    })
  }

  const config = useRuntimeConfig()
  const apiKey = config.googleMapsApiKey
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Maps API key not configured. Set NUXT_GOOGLE_MAPS_API_KEY in your .env'
    })
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${new URLSearchParams({
    place_id,
    fields: 'address_component,formatted_address,geometry',
    key: apiKey
  })}`

  try {
    const res: any = await $fetch(url)

    if (!res.result)
      return null

    return res.result
  } catch (error) {
    console.error('Google Maps Details API error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch place details'
    })
  }
})
