import { Image, Text, Title } from '@mantine/core';
import image from '@/assets/images/torai_explaine-3.jpg';
import classes from './Bunner02ImageRight.module.css';
import { useTranslation } from 'react-i18next';

export function Bunner02ImageRight() {
  const { t } = useTranslation();
  return (
    <div className={classes.wrapper}>
      <div className={classes.body}>
        <Title className={classes.title}>
          {t('home.banners.ui.title')}
        </Title>
        <Text fw={500} fz="md" mb={5}>
          {t('home.banners.ui.lead')}
        </Text>
        <Text fz="sm" c="dimmed">
          {t('home.banners.ui.description')}
        </Text>
      </div>
      <Image src={image} className={classes.image} />
    </div>
  );
}
