import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconArrowBackUp,
  IconChartBar,
  IconDatabaseImport,
  IconListCheck,
  IconMessages,
  IconSquareKey,
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
import classes from './NavigationAdmin.module.css';

// メニュー項目の型を定義
type MenuItem = {
  label: string;
  icon: React.FC<any>; // より具体的な型を使用
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

const NavigationAdmin = ({ onClose, onSidebarStateChange, sidebarState }: NavigationProps) => {
  const tablet_match = useMediaQuery('(max-width: 768px)');
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';

  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.isAdmin ?? false; // 安全なアクセスとデフォルト値

  // admin メニュー
  const adminLinks = {
    label: t('navigation.admin'),
    icon: IconUserShield,
    links: [
      ...(isJapanese
        ? [
            {
              label: t('navigation.adminBankTransfers'),
              icon: IconListCheck,
              link: '/admin/bank-transfer-requests',
            },
          ]
        : []),
      { label: t('navigation.adminSubscriptions'), icon: IconChartBar, link: '/admin/subscriptions' },
      { label: t('navigation.adminMessages'), icon: IconMessages, link: '/admin/messages' },
      { label: t('navigation.adminAccounts'), icon: IconSquareKey, link: '/admin/accounts-lock' },
      { label: t('navigation.adminSamples'), icon: IconDatabaseImport, link: '/admin/x-marketing-samples' },
    ],
  };

  const backMenu = [
    {
      title: t('common.back'),
      links: [{ label: t('navigation.backToApp'), icon: IconArrowBackUp, link: '/dashboard' }],
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
          {isAdmin && adminMenu()}
          {links(backMenu)}
        </div>
      </ScrollArea>

      <div className={classes.footer}>
        <UserProfileButton
          email={user?.email ?? 'not registered'}
          image={user?.avatarUrl ?? ''}
          name={user?.displayName ?? t('navigation.notRegistered')}
          showText={sidebarState !== 'mini'}
        />
      </div>
    </div>
  );
};

export default NavigationAdmin;
