import React from 'react'
import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { View, Flex, Heading, Text, Button, Well } from '@adobe/react-spectrum'

export default function ErrorPage() {
  const error = useRouteError() as unknown
  const status = isRouteErrorResponse(error) ? error.status : 500
  const statusText = isRouteErrorResponse(error) ? error.statusText : 'Unexpected Error'

  return (
    <View padding="size-600" UNSAFE_style={{ minHeight: '100vh', background: '#0b1220', color: '#e5e7eb' }}>
      <Flex direction="column" gap="size-300" alignItems="center" justifyContent="center" height="100%">
        <Heading level={1}>Something went wrong</Heading>
        <Well>
          <Flex direction="column" gap="size-200">
            <Text>We couldn't render this page.</Text>
            <Text>
              {status} {statusText}
            </Text>
          </Flex>
        </Well>
        <Flex gap="size-200">
          <Button variant="primary" onPress={() => (window.location.href = '/')}>Go to Dashboard</Button>
          <Button onPress={() => window.history.back()}>Go Back</Button>
        </Flex>
      </Flex>
    </View>
  )
}


