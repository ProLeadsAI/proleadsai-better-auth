/**
 * Composable for timezone management
 * Provides timezone list and formatting utilities
 */
export function useTimezone() {
  const timezones = [
    { label: 'Eastern Time (EST)', value: 'America/New_York' },
    { label: 'Central Time (CST)', value: 'America/Chicago' },
    { label: 'Mountain Time (MST)', value: 'America/Denver' },
    { label: 'Pacific Time (PST)', value: 'America/Los_Angeles' },
    { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
    { label: 'Hawaii Time (HST)', value: 'Pacific/Honolulu' }
  ]

  const defaultTimezone = timezones[0] // America/New_York

  /**
   * Find timezone object by value string
   * Returns default (Eastern) if not found in list
   */
  function findTimezone(value: string | null | undefined) {
    if (!value)
      return defaultTimezone
    const found = timezones.find(t => t.value === value)
    return found || defaultTimezone
  }

  /**
   * Extract timezone value from metadata object
   */
  function getTimezoneFromMetadata(metadata: any) {
    if (!metadata)
      return defaultTimezone

    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      if (parsed.timezone) {
        const tzValue = (typeof parsed.timezone === 'object' && parsed.timezone !== null)
          ? parsed.timezone.value
          : String(parsed.timezone).trim()
        return findTimezone(tzValue)
      }
    } catch {
      // Ignore parse error
    }

    return defaultTimezone
  }

  /**
   * Get timezone value string from timezone object or string
   */
  function getTimezoneValue(tz: any): string {
    if (typeof tz === 'string')
      return tz
    if (typeof tz === 'object' && tz !== null && 'value' in tz)
      return tz.value
    return defaultTimezone!.value
  }

  return {
    timezones,
    defaultTimezone,
    findTimezone,
    getTimezoneFromMetadata,
    getTimezoneValue
  }
}
