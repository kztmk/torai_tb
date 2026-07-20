import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { ActionIcon, Group, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  AppLanguage,
  getAppLanguage,
  setAppLanguage,
  supportedLanguages,
} from '@/i18n';
import { updatePreferredLanguage } from '@/store/reducers/auth';
import classes from './LanguagePicker.module.css';

type LanguagePickerProps = {
  type?: 'collapsed' | 'expanded';
  inverted?: boolean;
};

const LanguagePicker = ({ type = 'collapsed', inverted = false }: LanguagePickerProps) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user.uid);
  const selected = (i18n.resolvedLanguage || getAppLanguage()) as AppLanguage;

  const changeLanguage = async (language: AppLanguage) => {
    const previous = getAppLanguage();
    await setAppLanguage(language);
    if (userId === null) {
      return;
    }

    try {
      await dispatch(updatePreferredLanguage(language)).unwrap();
    } catch {
      await setAppLanguage(previous);
      notifications.show({
        color: 'red',
        title: t('common.error'),
        message: t('language.saveFailed'),
      });
    }
  };

  return (
    <Menu position="bottom-end" shadow="md" width={190} withinPortal>
      <Menu.Target>
        {type === 'expanded' ? (
          <UnstyledButton
            className={classes.control}
            aria-label={t('common.language')}
            data-inverted={inverted || undefined}
          >
            <Group gap={6} wrap="nowrap">
              <IconLanguage size={19} />
              <Text size="sm" fw={600} c="inherit">
                {supportedLanguages.find(({ code }) => code === selected)?.nativeLabel || 'Language'}
              </Text>
            </Group>
          </UnstyledButton>
        ) : (
          <Tooltip label={t('common.language')}>
            <ActionIcon aria-label={t('common.language')} variant="subtle">
              <IconLanguage size={20} />
            </ActionIcon>
          </Tooltip>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('common.language')}</Menu.Label>
        {supportedLanguages.map((language) => (
          <Menu.Item
            key={language.code}
            onClick={() => void changeLanguage(language.code)}
            rightSection={language.code === selected ? <IconCheck size={16} /> : null}
          >
            {language.nativeLabel}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};

export default LanguagePicker;
