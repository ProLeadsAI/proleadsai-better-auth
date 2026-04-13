import {
  Section,
  Text
} from '@react-email/components'
import { BaseEmail } from './BaseEmail'

interface InstallInstructionsProps {
  appName?: string
  organizationName: string
  installMode: 'inline' | 'floating'
  placementInstruction: string
  iframeUrl: string
  installCode: string
}

const codeBlock = {
  margin: '16px 0',
  padding: '16px',
  backgroundColor: '#0f172a',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontSize: '12px',
  lineHeight: '1.6',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const
}

export function InstallInstructions({
  appName,
  organizationName,
  installMode,
  placementInstruction,
  iframeUrl,
  installCode
}: InstallInstructionsProps) {
  return (
    <BaseEmail
      appName={appName}
      previewText={`Install instructions for ${organizationName}`}
      heading={`ProLeadsAI ${installMode === 'inline' ? 'inline' : 'floating'} install instructions`}
    >
      <Text>
        Hi,
      </Text>

      <Text>
        Here are the install instructions for
        {' '}
        <strong>{organizationName}</strong>
        .
      </Text>

      <Section>
        <Text>
          <strong>Placement:</strong>
          {' '}
          {placementInstruction}
        </Text>
        <Text>
          <strong>Mode:</strong>
          {' '}
          {installMode === 'inline' ? 'Inline section' : 'Floating button'}
        </Text>
        <Text>
          <strong>Iframe URL:</strong>
          {' '}
          {iframeUrl}
        </Text>
      </Section>

      <Text>
        <strong>Install code</strong>
      </Text>

      <Text style={codeBlock}>
        {installCode}
      </Text>
    </BaseEmail>
  )
}
