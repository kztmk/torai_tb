import { IconDots } from '@tabler/icons-react';
import {
  ActionIcon,
  Anchor,
  Button,
  ButtonProps,
  Group,
  Menu,
  rem,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAppSelector } from '@/hooks/rtkhooks';
import { useTranslation } from 'react-i18next';

const FooterNav = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const mobile_match = useMediaQuery('(max-width: 425px)');
  const { version } = useAppSelector((state) => state.apiController.triggerStatus);
  const { t } = useTranslation();

  const BUTTON_PROPS: ButtonProps = {
    variant: 'subtle',
    style: {
      padding: `${rem(8)} ${rem(12)}`,
      color: colorScheme === 'dark' ? theme.white : theme.black,

      '&:hover': {
        transition: 'all ease 150ms',
        backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2],
        textDecoration: 'none',
      },
    },
  };

  return (
    <Group justify="space-between">
      {mobile_match ? (
        <Menu shadow="md" width={200} position="right-end">
          <Menu.Target>
            <ActionIcon>
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item>
              <Anchor href="https://doc-torai.try-try.com/" target="_blank">
                {t('footer.support')}
              </Anchor>
            </Menu.Item>
            <Menu.Item>{t('footer.privacyPolicy')}</Menu.Item>
            <Menu.Item>{t('footer.license')}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ) : (
        <Group gap={4}>
          <Button {...BUTTON_PROPS}>
            <Anchor href="https://doc-torai.try-try.com/" target="_blank">
              {t('footer.support')}
            </Anchor>
          </Button>
          <Button {...BUTTON_PROPS}>
            <Anchor href="https://doc-torai.try-try.com/privacy-policy-ja" target="_blank">
              {t('footer.privacyPolicy')}
            </Anchor>
          </Button>
          <Button {...BUTTON_PROPS}>
            <Anchor href="https://doc-torai.try-try.com/license-agreement-ja" target="_blank">
              {t('footer.license')}
            </Anchor>
          </Button>
        </Group>
      )}
      <Text c="dimmed" fz="sm" component="a" href="#" target="_blank">
        &copy;&nbsp;{new Date().getFullYear()}&nbsp;{t('footer.company')}-ver.
        {import.meta.env.VITE_APP_VERSION}/
        {version}
      </Text>
    </Group>
  );
};

export default FooterNav;
