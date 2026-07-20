import { IconCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { Button, Container, Group, Image, List, Text, ThemeIcon } from '@mantine/core';
import pop01 from '@/assets/images/pop01.png';
import image from '@/assets/images/team-torai-p2.png';
import classes from './HeroBullets.module.css';
import { useTranslation } from 'react-i18next';

export function Hero2() {
  const { t } = useTranslation();
  return (
    <Container size="md">
      <div className={classes.inner}>
        <div className={classes.content}>
          <div className={classes.promotionContainer}>
            <div className={classes.priceImage}>
              <img src={pop01} alt="torai-work" />
            </div>

            <div className={classes.textContent}>
              <Text className={classes.title}>{t('home.hero.title')}</Text>
              <div className={classes.line2}>{t('home.hero.subtitle')}</div>
            </div>
          </div>

          <Text c="dimmed" mt="md">
            {t('home.hero.description')}
          </Text>

          <List
            mt={30}
            spacing="sm"
            size="sm"
            icon={
              <ThemeIcon size={20} radius="xl">
                <IconCheck size={12} stroke={1.5} />
              </ThemeIcon>
            }
          >
            <List.Item>
              <b>{t('home.hero.points.aiTitle')}</b> – {t('home.hero.points.aiDescription')}
            </List.Item>
            <List.Item>
              <b>{t('home.hero.points.uiTitle')}</b> – {t('home.hero.points.uiDescription')}
            </List.Item>
            <List.Item>
              <b>{t('home.hero.points.threadTitle')}</b> – {t('home.hero.points.threadDescription')}
            </List.Item>
            <List.Item>
              <b>{t('home.hero.points.accountsTitle')}</b> – {t('home.hero.points.accountsDescription')}
            </List.Item>
          </List>

          <Group mt={30}>
            <Button
              component={Link}
              to="/auth/signin"
              radius="xl"
              size="md"
              className={classes.control}
            >
              {t('home.hero.start')}
            </Button>
            <Button
              variant="default"
              radius="xl"
              size="md"
              className={classes.control}
              component="a"
              href="https://doc-torai.try-try.com"
            >
              {t('home.hero.manual')}
            </Button>
          </Group>
        </div>
        <Image src={image} className={classes.image} />
      </div>
    </Container>
  );
}
