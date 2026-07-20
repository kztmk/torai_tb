import { Image, Text, Title } from '@mantine/core';
import image from '@/assets/images/xAccounts.jpg';
import classes from '../Bunner02/Bunner02ImageRight.module.css';
import { useTranslation } from 'react-i18next';

export function Bunner04ImageRight() {
  const { t } = useTranslation();
  return (
    <div className={classes.wrapper}>
      <div className={classes.body}>
        <Title className={classes.title}>{t('home.banners.accounts.title')}</Title>
        <Text fw={500} fz="md" mb={5}>
          {t('home.banners.accounts.lead')}
        </Text>
        <Text fz="sm" c="dimmed">
          {t('home.banners.accounts.description')}
        </Text>
      </div>
      <Image src={image} className={classes.image} />
    </div>
  );
}
