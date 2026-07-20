// EmailBannerLeft.tsx
import { Image, Text, Title } from '@mantine/core';
import image from '@/assets/images/Torai_explaine-5a.png';
import classes from '../Bunner01/Bunner01ImageLeft.module.css';
import { useTranslation } from 'react-i18next';

export function Bunner03ImageLeft() {
  const { t } = useTranslation();
  return (
    <div className={classes.wrapper}>
      <Image src={image} className={classes.image} />
      <div className={classes.body}>
        <Title className={classes.title}>{t('home.banners.thread.title')}</Title>
        <Text fw={500} fz="md" mb={5}>
          {t('home.banners.thread.lead')}
        </Text>
        <Text fz="sm" c="dimmed">
          {t('home.banners.thread.description')}
        </Text>
      </div>
    </div>
  );
}
