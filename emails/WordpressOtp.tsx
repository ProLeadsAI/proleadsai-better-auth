import { Section, Text } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

const text = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#111827',
  margin: '0 0 16px'
}

const otpContainer = {
  textAlign: 'center' as const,
  margin: '24px 0'
}

const otpCode = {
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  color: '#10b981',
  padding: '16px 24px',
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  display: 'inline-block'
}

const noteText = {
  fontSize: '13px',
  color: '#6b7280',
  textAlign: 'center' as const
}

interface WordpressOtpProps {
  otp: string
  name: string
  appName?: string
}

export function WordpressOtp({
  otp,
  name,
  appName
}: WordpressOtpProps) {
  return (
    <BaseEmail
      previewText={`Your verification code is ${otp}`}
      heading="WordPress Verification Code"
      appName={appName}
      footerText="If you didn't request this code, you can safely ignore this email."
    >
      <Text style={text}>
        Hello
        {' '}
        {name}
        ,
      </Text>
      <Text style={text}>
        Use the following code to verify your WordPress plugin installation:
      </Text>
      <Section style={otpContainer}>
        <Text style={otpCode}>{otp}</Text>
      </Section>
      <Text style={noteText}>
        This code expires in 30 minutes.
      </Text>
    </BaseEmail>
  )
}

export default WordpressOtp
