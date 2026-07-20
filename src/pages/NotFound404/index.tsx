import { Link } from 'react-router-dom';
import { Button, Container, Group, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import Illustration from '@/assets/images/404.jpg';
import classes from './NotFound404.module.css';

const NotFound404 = () => {
  const { t } = useTranslation();
  return (
    <Container className={classes.root}>
      <div className={classes.inner}>
        <img src={Illustration} className={classes.image} alt={t('notFound.imageAlt')} />
        <div className={classes.content}>
          <Title className={classes.title}>{t('notFound.title')}</Title>
          <Text c="dimmed" size="lg" ta="center" className={classes.description}>
            {t('notFound.description')}
          </Text>
          <Group justify="center">
            <Button size="md" component={Link} to="/dashboard">
              {t('notFound.back')}
            </Button>
          </Group>
        </div>
      </div>
    </Container>
  );
};

export default NotFound404;
