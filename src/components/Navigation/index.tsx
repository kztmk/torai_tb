import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconBook2,
  IconBrandX,
  IconBrandXdeep,
  IconChartBar,
  IconExclamationCircle,
  IconLicense,
  IconList,
  IconListCheck,
  IconMessageCircle,
  IconUserCircle,
  IconUserShield,
  IconX,
} from '@tabler/icons-react';
import { ActionIcon, Box, Flex, Group, ScrollArea, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Logo } from '@/components';
import { LinksGroup } from '@/components/Navigation/Links/';
import UserProfileButton from '@/components/UserProfileButton';
import { useAppSelector } from '@/hooks/rtkhooks';
import { SidebarState } from '@/layouts/MainLayout/Sidebar/AppsLayout';
import { XAccount } from '@/types/xAccounts';
import classes from './Navigation.module.css';

// メニュー項目の型を定義
type MenuItem = {
  label: string;
  icon: React.FC<any>; // アイコンコンポーネントの型
  link: string;
  links?: MenuItem[]; // サブメニューの場合
};

// メニュー見出しグループの型
type MenuGroup = {
  title: string;
  links: MenuItem[];
};

type NavigationProps = {
  onClose: () => void;
  sidebarState: SidebarState;
  onSidebarStateChange: (state: SidebarState) => void;
};

const Navigation = ({ onClose, onSidebarStateChange, sidebarState }: NavigationProps) => {
  const tablet_match = useMediaQuery('(max-width: 768px)');
  const { t } = useTranslation();

  const xAccounts = useAppSelector((state) => state.xAccounts.xAccountList);
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user.isAdmin;

  // admin メニュー
  const adminLinks = {
    label: t('navigation.admin'),
    icon: IconUserShield,
    links: [{ label: t('navigation.admin'), icon: IconListCheck, link: '/admin' }],
  };

  const xAccountLinks = {
    label: 'X',
    icon: IconBrandX,
    link: '/dashboard/x-accounts',
    links: xAccounts.map((xAccount: XAccount) => ({
      label: `@${xAccount.id}`,
      icon: IconBrandXdeep,
      link: `/dashboard/x-accounts/${xAccount.id}`,
    })),
  };

  const xMarketingLinks = {
    label: t('navigation.xMarketing'),
    icon: IconMessageCircle,
    link: '/dashboard/x-marketing/inbox',
    links: [
      { label: t('navigation.inbox'), link: '/dashboard/x-marketing/inbox' },
      { label: t('navigation.crm'), link: '/dashboard/x-marketing/crm' },
      { label: t('navigation.analytics'), link: '/dashboard/x-marketing/analytics' },
    ],
  };

  const mainMenu: MenuGroup[] = [
    {
      title: t('navigation.dashboard'),
      links: [
        { label: t('navigation.activity'), icon: IconChartBar, link: '/dashboard' },
        { label: t('navigation.profile'), icon: IconUserCircle, link: '/profile' },
      ],
    },
  ];

  const docsMenu: MenuGroup[] = [
    {
      title: t('navigation.documents'),
      links: [
        {
          label: t('navigation.aboutTorai'),
          icon: IconExclamationCircle,
          link: 'https://doc-torai.try-try.com/',
        },
        { label: t('navigation.terms'), icon: IconLicense, link: '/terms' },
        {
          label: t('navigation.manual'),
          icon: IconBook2,
          link: 'https://docs.try-try.com',
        },
        { label: t('navigation.updates'), icon: IconList, link: 'https://docs.try-try.com/blog' },
        {
          label: t('navigation.privacyPolicy'),
          icon: IconList,
          link: 'https://doc-torai.try-try.com/privacy-policy',
        },
        {
          label: t('navigation.termsAndConditions'),
          icon: IconList,
          link: 'https://doc-torai.try-try.com/terms-and-conditions',
        },
      ],
    },
  ];

  const adminMenu = () => (
    <Box key="snsLinks-admin" pl={0} mb={sidebarState === 'mini' ? 0 : 'md'}>
      {sidebarState !== 'mini' && (
        <Text tt="uppercase" size="xs" pl="md" fw={500} mb="sm" className={classes.linkHeader}>
          {t('navigation.administration')}
        </Text>
      )}
      <LinksGroup
        key="xAccount"
        {...adminLinks}
        isMini={sidebarState === 'mini'}
        closeSidebar={() => {
          setTimeout(() => {
            onClose();
          }, 250);
        }}
      />
    </Box>
  );

  const snsLinks = () => (
    <Box key="snsLinks" pl={0} mb={sidebarState === 'mini' ? 0 : 'md'}>
      {sidebarState !== 'mini' && (
        <Text tt="uppercase" size="xs" pl="md" fw={500} mb="sm" className={classes.linkHeader}>
          SNS
        </Text>
      )}
      <LinksGroup
        key="xAccount"
        {...xAccountLinks}
        isMini={sidebarState === 'mini'}
        closeSidebar={() => {
          setTimeout(() => {
            onClose();
          }, 250);
        }}
      />
      <LinksGroup
        key="xMarketing"
        {...xMarketingLinks}
        isMini={sidebarState === 'mini'}
        closeSidebar={() => setTimeout(() => onClose(), 250)}
      />
    </Box>
  );

  const links = (menu: MenuGroup[]) =>
    menu.map((m) => (
      <Box key={m.title} pl={0} mb={sidebarState === 'mini' ? 0 : 'md'}>
        {sidebarState !== 'mini' && (
          <Text tt="uppercase" size="xs" pl="md" fw={500} mb="sm" className={classes.linkHeader}>
            {m.title}
          </Text>
        )}
        {m.links.map((item) => (
          <LinksGroup
            key={item.label}
            {...item}
            isMini={sidebarState === 'mini'}
            closeSidebar={() => {
              setTimeout(() => {
                onClose();
              }, 250);
            }}
          />
        ))}
      </Box>
    ));

  useEffect(() => {
    if (tablet_match) {
      onSidebarStateChange('full');
    }
  }, [onSidebarStateChange, tablet_match]);

  return (
    <div className={classes.navbar} data-sidebar-state={sidebarState}>
      <div className={classes.header}>
        <Flex justify="space-between" align="center" gap="sm">
          <Group
            justify={sidebarState === 'mini' ? 'center' : 'space-between'}
            style={{ flex: tablet_match ? 'auto' : 1 }}
          >
            <Logo className={classes.logo} showText={sidebarState !== 'mini'} />
          </Group>
          {tablet_match && (
            <ActionIcon onClick={onClose} variant="transparent">
              <IconX color="white" />
            </ActionIcon>
          )}
        </Flex>
      </div>

      <ScrollArea className={classes.links}>
        <div className={classes.linksInner} data-sidebar-state={sidebarState}>
          {links(mainMenu)}
          {snsLinks()}
          {links(docsMenu)}
          {isAdmin && adminMenu()}
        </div>
      </ScrollArea>

      <div className={classes.footer}>
        <UserProfileButton
          email={user.email ?? 'not registered'}
          image={user.avatarUrl ?? ''}
          name={user.displayName ?? t('navigation.notRegistered')}
          showText={sidebarState !== 'mini'}
        />
      </div>
    </div>
  );
};

export default Navigation;
