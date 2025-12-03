// Utility to decode address components from Google Geocoding API response

export interface DecodedAddress {
  streetAddress: string
  streetAddress2: string
  postOfficeBoxNumber: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

export function decodeAddressFromGeocode(components: any[]): DecodedAddress {
  const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name || ''
  const route = components.find((c: any) => c.types.includes('route'))?.long_name || ''
  const streetAddress = `${streetNumber} ${route}`.trim()
  const streetAddress2 = components.find((c: any) => c.types.includes('subpremise'))?.long_name || ''
  const postOfficeBoxNumber = components.find((c: any) => c.types.includes('post_box'))?.long_name || ''
  let addressLocality = components.find((c: any) => c.types.includes('locality'))?.long_name || ''
  if (!addressLocality) {
    addressLocality = components.find((c: any) => c.types.includes('administrative_area_level_3'))?.long_name || ''
  }
  const addressRegion = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || ''
  const postalCode = components.find((c: any) => c.types.includes('postal_code'))?.long_name || ''
  const addressCountry = components.find((c: any) => c.types.includes('country'))?.short_name || ''

  return {
    streetAddress,
    streetAddress2,
    postOfficeBoxNumber,
    addressLocality,
    addressRegion,
    postalCode,
    addressCountry
  }
}
