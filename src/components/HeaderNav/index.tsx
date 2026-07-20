import {
  IconBell,
  IconCircleHalf2,
  IconMoonStars,
  IconPower,
  IconSearch,
  IconSunHigh,
  IconX,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Burger,
  Flex,
  Group,
  Indicator,
  Menu,
  rem,
  Stack,
  Text,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { SidebarState } from '@/layouts/MainLayout/Sidebar/AppsLayout';
import { setImage } from '@/pages/HomePage/FeaturesImages/FeaturesImages';
import { signOut } from '@/store/reducers/auth';
import { fetchUserMessageOverview } from '@/store/reducers/messagesSlice';
import LanguagePicker from '@/components/LanguagePicker';

const ICON_SIZE = 20;

type HeaderNavProps = {
  mobileOpened?: boolean;
  toggleMobile?: () => void;
  sidebarState: SidebarState;
  onSidebarStateChange: () => void;
};

const HeaderNav = (props: HeaderNavProps) => {
  const { toggleMobile, mobileOpened, onSidebarStateChange } = props;
  const theme = useMantineTheme();
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const mobile_match = useMediaQuery('(max-width: 425px)');
  const { t } = useTranslation();

  const { sysAnnouncements } = useAppSelector((state) => state.systemAnnouncements);
  const { unreadCount: unreadMessageCount } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchUserMessageOverview());
    }
  }, [dispatch, user?.uid]);

  const handleSingOut = async () => {
    try {
      await dispatch(signOut()).unwrap();
      navigate('/auth/signin', { replace: true });
    } catch (error) {
      notifications.show({
        title: t('common.error'),
        message: typeof error === 'string' ? error : t('header.signOutFailed'),
        color: 'red',
        icon: <IconX size={rem(16)} />,
      });
    }
  };

  const sysNotifications = sysAnnouncements.map((n) => (
    <Menu.Item
      key={n.id}
      style={{
        borderBottom: `1px solid ${
          colorScheme === 'dark' ? theme.colors.gray[7] : theme.colors.gray[3]
        }`,
      }}
    >
      <Flex gap="sm" align="center">
        <Avatar src={setImage(n.status)} alt={n.title} variant="filled" size="sm" />
        <Stack gap={1}>
          <Text fz="sm" fw={600}>
            {n.title}
          </Text>
          <Text lineClamp={2} fz="xs" c="dimmed">
            {n.date}
          </Text>
          <Text lineClamp={2} fz="xs" c="dimmed">
            {n.description}
          </Text>
        </Stack>
      </Flex>
    </Menu.Item>
  ));

  return (
    <Group justify="space-between">
      <Group gap={0}>
        <Tooltip label={t('header.toggleNavigation')}>
          <Burger visibleFrom="md" size="sm" onClick={onSidebarStateChange} />
        </Tooltip>
        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="md" size="sm" />
        {/*<Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="md" size="sm"/>*/}
      </Group>
      <Group>
        {mobile_match && (
          <ActionIcon>
            <IconSearch size={ICON_SIZE} />
          </ActionIcon>
        )}
        <Menu shadow="lg" width={320}>
          <Menu.Target>
            <Indicator
              disabled={unreadMessageCount === 0}
              label={unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              size={18}
              offset={4}
              color="red"
            >
              <Tooltip label={t('header.notifications')}>
                <ActionIcon size="lg" title={t('header.notifications')}>
                  <IconBell size={ICON_SIZE} />
                </ActionIcon>
              </Tooltip>
            </Indicator>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label tt="uppercase" ta="center" fw={600}>
              {t('header.messages')}
            </Menu.Label>
            <Menu.Item onClick={() => navigate('/messages')}>
              <Group justify="space-between">
                <Text size="sm">{t('header.openMessages')}</Text>
                {unreadMessageCount > 0 && (
                  <Badge color="red">{t('header.unread', { count: unreadMessageCount })}</Badge>
                )}
              </Group>
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label tt="uppercase" ta="center" fw={600}>
              {t('header.systemNotifications')}
            </Menu.Label>
            {sysNotifications}
          </Menu.Dropdown>
        </Menu>
        <LanguagePicker />
        <Tooltip label={t('header.signOut')}>
          <ActionIcon onClick={handleSingOut}>
            <IconPower size={ICON_SIZE} />
          </ActionIcon>
        </Tooltip>
        <Menu shadow="lg" width={200}>
          <Menu.Target>
            <Tooltip label={t('header.colorMode')}>
              <ActionIcon variant="light">
                {colorScheme === 'auto' ? (
                  <IconCircleHalf2 size={ICON_SIZE} />
                ) : colorScheme === 'dark' ? (
                  <IconMoonStars size={ICON_SIZE} />
                ) : (
                  <IconSunHigh size={ICON_SIZE} />
                )}
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label tt="uppercase" ta="center" fw={600}>
              {t('header.colorMode')}
            </Menu.Label>
            <Menu.Item
              leftSection={<IconSunHigh size={16} />}
              onClick={() => setColorScheme('light')}
            >
              {t('header.light')}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconMoonStars size={16} />}
              onClick={() => setColorScheme('dark')}
            >
              {t('header.dark')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
};

export default HeaderNav;
