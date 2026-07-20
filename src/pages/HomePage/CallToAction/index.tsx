import { Link } from 'react-router-dom';
import { Button, Container, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function CallToAction() {
  const { t } = useTranslation();
  return (
    <Container style={{ paddingTop: '24px', paddingBottom: '24px' }}>
      <Group justify="center" style={{ backgroundColor: '#ecf4ff' }}>
        <Button variant="subtle" size="md" component={Link} to="/auth/signin">
          {t('home.cta.start')}
        </Button>
        <Button variant="subtle" size="md" component="a" href="https://doc-torai.try-try.com">
          {t('home.cta.manual')}
        </Button>
      </Group>
    </Container>
  );
}
