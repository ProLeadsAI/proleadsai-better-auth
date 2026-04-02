import { Section, Text } from '@react-email/components'
import { BaseEmail, EmailButton } from './BaseEmail'

const text = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#111827',
  margin: '0 0 16px'
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0'
}

const mutedText = {
  fontSize: '13px',
  color: '#6b7280'
}

interface SubscriptionExpiredProps {
  name: string
  teamName: string
  planName: string
  billingUrl: string
  appName?: string
}

export function SubscriptionExpired({
  name,
  teamName,
  planName,
  billingUrl,
  appName
}: SubscriptionExpiredProps) {
  return (
    <BaseEmail
      previewText={`Your ${planName} subscription has expired`}
      heading="Subscription Expired"
      appName={appName}
    >
      <Text style={text}>
        Hello
        {' '}
        {name}
        ,
      </Text>
      <Text style={text}>
        Your
        {' '}
        <strong>{planName}</strong>
        {' '}
        subscription for
        {' '}
        <strong>{teamName}</strong>
        {' '}
        has expired and your organization has been downgraded to the free plan.
      </Text>

      <Text style={text}>
        Your organization data will be retained for
        {' '}
        <strong>90 days</strong>
        . After that, it will be permanently deleted.
      </Text>

      <Text style={text}>
        You can reactivate your subscription at any time to regain access to Pro features and your organization data.
      </Text>

      <Section style={buttonContainer}>
        <EmailButton href={billingUrl}>Reactivate Subscription</EmailButton>
      </Section>

      <Text style={mutedText}>
        If you have any questions or need assistance, please contact our support team.
      </Text>
    </BaseEmail>
  )
}

export default SubscriptionExpired
