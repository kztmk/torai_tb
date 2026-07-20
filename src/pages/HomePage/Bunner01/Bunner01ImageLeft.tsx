// EmailBannerLeft.tsx
import { Image, Text, Title } from '@mantine/core';
import image from '@/assets/images/Torai_explaine-4.png';
import classes from './Bunner01ImageLeft.module.css';
import { useTranslation } from 'react-i18next';

export function Bunner01ImageLeft() {
  const { t } = useTranslation();
  return (
    <div className={classes.wrapper}>
      <Image src={image} className={classes.image} />
      <div className={classes.body}>
        <Title className={classes.title}>{t('home.banners.ai.title')}</Title>
        <Text fw={500} fz="md" mb={5}>
          {t('home.banners.ai.lead')}
        </Text>
        <Text fz="sm" c="dimmed">
          {t('home.banners.ai.description')}
        </Text>
      </div>
    </div>
  );
}
