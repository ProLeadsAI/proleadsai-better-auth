import { Link, Section, Text } from '@react-email/components'
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

const linkText = {
  fontSize: '13px',
  color: '#6b7280',
  wordBreak: 'break-all' as const
}

const link = {
  color: '#10b981'
}

interface MagicLinkProps {
  name: string
  url: string
  appName?: string
}

export function MagicLink({
  name,
  url,
  appName
}: MagicLinkProps) {
  return (
    <BaseEmail
      previewText="Your magic link to sign in"
      heading="Sign in to your account"
      appName={appName}
      footerText="If you didn't request this link, you can safely ignore this email."
    >
      <Text style={text}>
        Hello
        {' '}
        {name}
        ,
      </Text>
      <Text style={text}>
        Click the button below to sign in to your account. This link will expire in 10 minutes.
      </Text>
      <Section style={buttonContainer}>
        <EmailButton href={url}>Sign In</EmailButton>
      </Section>
      <Text style={linkText}>
        Or copy this link:
        {' '}
        <Link href={url} style={link}>
          {url}
        </Link>
      </Text>
    </BaseEmail>
  )
}

export default MagicLink
