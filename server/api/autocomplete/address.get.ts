export default defineEventHandler(async (event) => {
  const { q } = getQuery(event)

  if (!q || typeof q !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid query parameter: q'
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

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${new URLSearchParams({
    input: q,
    types: 'address',
    components: 'country:us',
    key: apiKey
  })}`

  try {
    const res: any = await $fetch(url)

    if (!res.predictions)
      return []

    return res.predictions.map((p: any) => ({
      label: p.description,
      value: p.place_id
    }))
  } catch (error) {
    console.error('Google Maps API error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch autocomplete results'
    })
  }
})
