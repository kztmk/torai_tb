import { Link as RouterLink } from 'react-router-dom';
import { Group, Text, UnstyledButton, UnstyledButtonProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import LogoImage from '@/assets/images/torai_icon512.png';
import classes from './Logo.module.css';

type LogoProps = {
  to?: string;
  showText?: boolean;
} & UnstyledButtonProps;

const Logo = ({ to, showText = true, ...others }: LogoProps) => {
  const { t } = useTranslation();
  // RouterLinkラッパーコンポーネントを作成
  const LinkComponent = ({ to, ...props }: any) => <RouterLink to={to || '/'} {...props} />;

  return (
    <UnstyledButton className={classes.logo} component={LinkComponent} to={to || '/'} {...others}>
      <Group gap="xs">
        <img
          className={classes.logoImage}
          src={LogoImage}
          height={showText ? 32 : 24}
          width={showText ? 32 : 24}
          alt={t('common.logoAlt')}
        />
        {showText && <Text fw={700}>{t('common.appName')}</Text>}
      </Group>
    </UnstyledButton>
  );
};

export default Logo;
