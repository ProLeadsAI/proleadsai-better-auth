/**
 * Calculates haversine distance between two lat/lng points in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

/**
 * Gets a human-readable direction from azimuth angle
 */
export function getDirectionFromAzimuth(azimuth: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
  const index = Math.round(azimuth / 45) % 8
  return directions[index]
}

/**
 * Fetches roof data from the Google Solar API
 */
export async function getRoofDataFromSolar(
  coordinates: { lat: number, lng: number },
  apiKey: string
): Promise<any> {
  if (!coordinates || !coordinates.lat || !coordinates.lng) {
    throw new Error('Invalid coordinates')
  }

  if (!apiKey) {
    throw new Error('API key is required')
  }

  const solarApiUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lng}&requiredQuality=HIGH&key=${apiKey}`

  const response = await fetch(solarApiUrl)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Solar API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  data.center = {
    latitude: coordinates.lat,
    longitude: coordinates.lng
  }

  return data
}

/**
 * Calculate the roof area from solar data
 */
export function calculateRoofArea(solarData: any): number {
  if (!solarData || !solarData.solarPotential) {
    return 0
  }

  if (solarData.solarPotential.wholeRoofStats?.groundAreaMeters2) {
    return solarData.solarPotential.wholeRoofStats.groundAreaMeters2 * 10.7639
  }

  const segments = solarData.solarPotential.roofSegmentStats || []
  let totalRoofArea = 0

  for (const segment of segments) {
    if (segment.pitchDegrees > 0 && segment.groundAreaMeters > 0) {
      totalRoofArea += segment.groundAreaMeters * 10.7639
    }
  }

  return totalRoofArea
}

/**
 * Calculate the estimate for roof replacement
 */
export function calculateRoofEstimate(roofAreaSqFt: number, pricePerSqFt: number): number {
  const roofSquares = roofAreaSqFt / 100
  return Math.round(roofSquares * pricePerSqFt)
}

/**
 * Extract roof outline points from solar data segments
 */
export function extractRoofOutlinePoints(segments: any[]): Array<{ lat: number, lng: number }> {
  if (!segments || segments.length === 0) {
    return []
  }

  const allPoints: Array<{ lat: number, lng: number }> = []

  for (const segment of segments) {
    if (!segment.boundingBox)
      continue

    const segmentBounds = segment.boundingBox

    if (segmentBounds.sw) {
      allPoints.push({
        lat: segmentBounds.sw.latitude,
        lng: segmentBounds.sw.longitude
      })
    }

    if (segmentBounds.sw && segmentBounds.ne) {
      allPoints.push({
        lat: segmentBounds.sw.latitude,
        lng: segmentBounds.ne.longitude
      })
    }

    if (segmentBounds.ne) {
      allPoints.push({
        lat: segmentBounds.ne.latitude,
        lng: segmentBounds.ne.longitude
      })
    }

    if (segmentBounds.ne && segmentBounds.sw) {
      allPoints.push({
        lat: segmentBounds.ne.latitude,
        lng: segmentBounds.sw.longitude
      })
    }
  }

  return calculateConvexHull(allPoints)
}

function cross(o: { lat: number, lng: number }, a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng)
}

function calculateConvexHull(points: Array<{ lat: number, lng: number }>): Array<{ lat: number, lng: number }> {
  if (points.length <= 3)
    return points

  const uniquePoints = removeDuplicatePoints(points)
  if (uniquePoints.length <= 3)
    return uniquePoints

  let lowestPoint = uniquePoints[0]
  for (const p of uniquePoints) {
    if (p.lat < lowestPoint.lat || (p.lat === lowestPoint.lat && p.lng < lowestPoint.lng)) {
      lowestPoint = p
    }
  }

  const sortedPoints = [...uniquePoints]
  sortedPoints.sort((a, b) => {
    const order = cross(lowestPoint, a, b)
    if (order === 0) {
      const distA = (a.lat - lowestPoint.lat) ** 2 + (a.lng - lowestPoint.lng) ** 2
      const distB = (b.lat - lowestPoint.lat) ** 2 + (b.lng - lowestPoint.lng) ** 2
      return distA - distB
    }
    return -order
  })

  const hull: Array<{ lat: number, lng: number }> = []

  for (const p of sortedPoints) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop()
    }
    hull.push(p)
  }

  return hull
}

function removeDuplicatePoints(points: Array<{ lat: number, lng: number }>): Array<{ lat: number, lng: number }> {
  const uniquePoints: Array<{ lat: number, lng: number }> = []
  const EPSILON = 0.0000001

  for (const p of points) {
    if (!uniquePoints.some(up =>
      Math.abs(up.lat - p.lat) < EPSILON &&
      Math.abs(up.lng - p.lng) < EPSILON
    )) {
      uniquePoints.push(p)
    }
  }

  return uniquePoints
}

/**
 * Categorize roof pitch based on segment data
 */
export function categorizeRoofPitch(segments: any[]): any {
  if (!segments || segments.length === 0) {
    return { pitchType: 'UNKNOWN' }
  }

  const pitchCategories = [
    { type: 'FLAT', min: 0, max: Math.atan(2 / 12) * 180 / Math.PI, ratio: '0:12-2:12', description: 'Very low slope or flat' },
    { type: 'LOW', min: Math.atan(2 / 12) * 180 / Math.PI, max: Math.atan(4 / 12) * 180 / Math.PI, ratio: '>2:12-4:12', description: 'Low pitch' },
    { type: 'NORMAL', min: Math.atan(4 / 12) * 180 / Math.PI, max: Math.atan(6 / 12) * 180 / Math.PI, ratio: '>4:12-6:12', description: 'Standard/typical pitch' },
    { type: 'STEEP', min: Math.atan(6 / 12) * 180 / Math.PI, max: Math.atan(9 / 12) * 180 / Math.PI, ratio: '>6:12-9:12', description: 'Steep pitch' },
    { type: 'VERY_STEEP', min: Math.atan(9 / 12) * 180 / Math.PI, max: 90, ratio: '>9:12', description: 'Very steep, dramatic slope' }
  ]

  const segmentInfo = segments.map((segment) => {
    const pitchDegrees = segment.pitchDegrees || 0
    const rise = Math.tan(pitchDegrees * Math.PI / 180) * 12
    const pitchRatio = Math.round(rise * 10) / 10

    const category = pitchCategories.find(cat =>
      pitchDegrees > cat.min && pitchDegrees <= cat.max
    ) || { type: 'UNKNOWN', ratio: 'Unknown', description: 'Unknown pitch' }

    return {
      pitchDegrees,
      pitchRatio: `${pitchRatio}:12`,
      pitchType: category.type,
      standardRatio: category.ratio,
      description: category.description,
      azimuthDegrees: segment.azimuthDegrees,
      direction: getDirectionFromAzimuth(segment.azimuthDegrees || 0),
      areaSqFt: segment.stats ? Math.round(segment.stats.areaMeters2 * 10.7639) : 0
    }
  })

  const pitchAreas: Record<string, number> = {}
  for (const segment of segmentInfo) {
    if (!pitchAreas[segment.pitchType]) {
      pitchAreas[segment.pitchType] = 0
    }
    pitchAreas[segment.pitchType] += segment.areaSqFt
  }

  let predominantPitchType = 'UNKNOWN'
  let maxArea = 0
  for (const [pitchType, area] of Object.entries(pitchAreas)) {
    if (area > maxArea) {
      maxArea = area
      predominantPitchType = pitchType
    }
  }

  return {
    segments: segmentInfo,
    predominantPitchType,
    pitchCategories
  }
}
