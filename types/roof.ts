// Define all shared interfaces for roof calculations

export interface RoofSegment {
  id: string
  area: number
  azimuth: number
  pitch: number
  gutterLengthFeet?: number
}

export interface RoofStats {
  totalAreaSqFt: number
  segments: {
    pitchDegrees: number
    azimuthDegrees: number
    areaSqFt: number
  }[]
}

export interface SolarPotential {
  maxPanelsCount: number
  yearlyEnergyDcKwh: number
  carbonOffset: number
}

export interface Costs {
  roofReplacementCost: number
  gutterReplacementCost: number
  solarInstallationCost: number
  federalTaxCredit: number
  afterIncentiveCost: number
}

export interface PropertyData {
  address: string
  coordinates: {
    lat: number
    lng: number
  }
  segments: RoofSegment[]
  roofStats: RoofStats
  solarPotential: SolarPotential
  costs: Costs
  rawData: any
}
