import {
  Section,
  Text
} from '@react-email/components'
import { BaseEmail } from './BaseEmail'

interface LeadSubmittedProps {
  appName?: string
  teamName: string
  leadName?: string | null
  leadEmail?: string | null
  leadPhone?: string | null
  address?: string | null
  roofSizeSqFt?: number | null
  roofPrice?: number | null
}

export function LeadSubmitted({
  appName,
  teamName,
  leadName,
  leadEmail,
  leadPhone,
  address,
  roofSizeSqFt,
  roofPrice
}: LeadSubmittedProps) {
  const formattedRoofPrice = typeof roofPrice === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(roofPrice)
    : 'N/A'

  const formattedRoofSize = typeof roofSizeSqFt === 'number'
    ? `${roofSizeSqFt.toLocaleString('en-US')} sq ft`
    : 'N/A'

  return (
    <BaseEmail
      appName={appName}
      previewText={`New lead submitted for ${teamName}`}
      heading="ProLeadsAI - New lead submitted"
    >
      <Text>
        A new lead was submitted for
        {' '}
        <strong>{teamName}</strong>
        .
      </Text>

      <Section>
        <Text>
          <strong>Name:</strong>
          {' '}
          {leadName || 'N/A'}
        </Text>
        <Text>
          <strong>Email:</strong>
          {' '}
          {leadEmail || 'N/A'}
        </Text>
        <Text>
          <strong>Phone:</strong>
          {' '}
          {leadPhone || 'N/A'}
        </Text>
        <Text>
          <strong>Address:</strong>
          {' '}
          {address || 'N/A'}
        </Text>
        <Text>
          <strong>Roof size:</strong>
          {' '}
          {formattedRoofSize}
        </Text>
        <Text>
          <strong>Roof price:</strong>
          {' '}
          {formattedRoofPrice}
        </Text>
      </Section>
    </BaseEmail>
  )
}
