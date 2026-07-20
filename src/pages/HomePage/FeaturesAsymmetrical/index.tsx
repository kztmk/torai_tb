import { IconBrandGoogle, IconBrandX } from '@tabler/icons-react';
import { Container, SimpleGrid, Text, Title } from '@mantine/core';
import { GeminiIcon } from './GeminiIcon';
import classes from './FeaturesAsymmetrical.module.css';
import { useTranslation } from 'react-i18next';

interface FeatureProps extends React.ComponentPropsWithoutRef<'div'> {
  icon: React.FC<any>;
  title: string;
  description: string;
}

function Feature({ icon: Icon, title, description, className, ...others }: FeatureProps) {
  return (
    <div className={classes.feature} {...others}>
      <div className={classes.overlay} />

      <div className={classes.content}>
        <Icon size={38} className={classes.icon} stroke={1.5} />
        <Text fw={700} fz="lg" mb="xs" mt={5} className={classes.title}>
          {title}
        </Text>
        <Text c="dimmed" fz="sm">
          {description}
        </Text>
      </div>
    </div>
  );
}

export function FeaturesAsymmetrical() {
  const { t } = useTranslation();
  const icons = [IconBrandX, IconBrandGoogle, GeminiIcon];
  const mockdata = icons.map((icon, index) => ({
    icon,
    title: t(`home.setup.items.${index}.title`),
    description: t(`home.setup.items.${index}.description`),
  }));
  const items = mockdata.map((item) => <Feature {...item} key={item.title} />);

  return (
    <Container size={700} className={classes.wrapper}>
      <Text className={classes.supTitle}>{t('home.setup.title')}</Text>

      <Title className={classes.subTitle} order={2}>
        {t('home.setup.description')}
      </Title>
      <Container mt={30} mb={30} size="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={50}>
          {items}
        </SimpleGrid>
      </Container>
    </Container>
  );
}
