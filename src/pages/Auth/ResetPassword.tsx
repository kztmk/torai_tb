import { Link } from 'react-router-dom';
import { Button, Center, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export default function PasswordResetSuccessPage() {
  const { t } = useTranslation();
  return (
    <Container size="xs" py="xl">
      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <Title order={1} ta="center">
            {t('auth.resetEmailSentTitle')}
          </Title>

          <Text size="md" ta="center">
            {t('auth.resetEmailInstructions')}
          </Text>

          <Center>
            <Button component={Link} to="/auth/signin" variant="subtle" color="blue">
              {t('auth.backToSignIn')}
            </Button>
          </Center>
        </Stack>
      </Paper>
    </Container>
  );
}
