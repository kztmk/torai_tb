import { IconPlayerPlay } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import {
  Box,
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  rem,
  ScrollArea,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Logo } from '@/components';
import LanguagePicker from '@/components/LanguagePicker';
import { useTranslation } from 'react-i18next';
// import { PATH_AUTH, PATH_DASHBOARD, PATH_DOCS, PATH_GITHUB } from '@/routes';

import classes from './HeaderNav.module.css';

// Button component="a" は外部リンク
// Button component={Link} は内部リンク
const HeaderNav = () => {
  const theme = useMantineTheme();
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const tablet_match = useMediaQuery('(max-width: 768px)');
  const { t } = useTranslation();

  const links = [
    { link: 'https://doc-torai.try-try.com/', label: t('guest.manual') },
    {
      link: 'https://doc-torai.try-try.com/privacy-policy',
      label: t('guest.privacyPolicy'),
    },
    {
      link: 'https://doc-torai.try-try.com/terms-and-conditions',
      label: t('guest.terms'),
    },
    { link: 'mailto:support@imakita3gyo.com', label: t('guest.contact') },
  ];

  const items = links.map((link) => {
    return (
      <a
        key={link.label}
        href={link.link}
        target="_blank"
        rel="noreferrer"
        className={classes.link}
      >
        {link.label}
      </a>
    );
  });

  return (
    <Box>
      <header className={classes.header}>
        <Container className={classes.inner} fluid>
          <Logo style={{ color: theme.white }} />
          <Group gap="xs" className={classes.links}>
            {items}
            <LanguagePicker type="expanded" inverted />
            <Button component={Link} to="/auth/signin" leftSection={<IconPlayerPlay size={16} />}>
              {t('guest.signInOrCreate')}
            </Button>
          </Group>
          <Burger
            opened={drawerOpened}
            onClick={toggleDrawer}
            className={classes.hiddenDesktop}
            color={theme.white}
          />
        </Container>
      </header>
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        size="100%"
        padding="md"
        title={t('guest.menu')}
        className={classes.hiddenDesktop}
        zIndex={1000000}
        transitionProps={{
          transition: tablet_match ? 'slide-up' : 'slide-left',
        }}
      >
        <ScrollArea h={`calc(100vh - ${rem(60)})`} mx="-md">
          {items}
          <LanguagePicker type="expanded" />
          <Button component={Link} to="/auth/signin" leftSection={<IconPlayerPlay size={16} />}>
            {t('auth.signIn')}
          </Button>
        </ScrollArea>
      </Drawer>
    </Box>
  );
};

export default HeaderNav;
