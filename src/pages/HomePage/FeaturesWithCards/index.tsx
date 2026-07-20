import {
  IconBrandGoogleDrive,
  IconBrandX,
  IconGauge,
  IconHandClick,
  IconListTree,
  IconMessageReport,
} from '@tabler/icons-react';
import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import classes from './FeaturesWithCards.module.css';
import { useTranslation } from 'react-i18next';

export function FeaturesWithCards() {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const icons = [IconGauge, IconHandClick, IconBrandGoogleDrive, IconListTree, IconMessageReport, IconBrandX];
  const mockdata = icons.map((icon, index) => ({
    icon,
    title: t(`home.features.items.${index}.title`),
    description: t(`home.features.items.${index}.description`),
  }));
  const features = mockdata.map((feature) => (
    <Card key={feature.title} shadow="md" radius="md" className={classes.card} padding="xl">
      <feature.icon size={50} stroke={1.5} color={theme.colors.blue[6]} />
      <Text fz="lg" fw={500} className={classes.cardTitle} mt="md">
        {feature.title}
      </Text>
      <Text fz="sm" c="dimmed" mt="sm">
        {feature.description}
      </Text>
    </Card>
  ));

  return (
    <Container size="lg" py="xl">
      <Group justify="center">
        <Badge variant="filled" size="lg">
          {t('home.features.badge')}
        </Badge>
      </Group>

      <Title order={2} className={classes.title} ta="center" mt="sm">
        {t('home.features.title')}
      </Title>

      <Text c="dimmed" className={classes.description} ta="center" mt="md">
        {t('home.features.description')}
      </Text>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl" mt={50}>
        {features}
      </SimpleGrid>
    </Container>
  );
}
