import { useState } from 'react';
import { IconAlertCircle } from '@tabler/icons-react';
import { Alert, Container, Paper, Tabs, Title } from '@mantine/core';
import { useAppSelector } from '@/hooks/rtkhooks';
import SheetData from './SheetData';
import Trigger from './Trigger';
import { useTranslation } from 'react-i18next';

/**
 * Activityコンポーネント
 * サインイン後に表示される画面。Google SheetのURLが設定されているかチェックし、
 * 設定されている場合はTriggerとSheetDataコンポーネントを表示する。
 */
const Activity = () => {
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState<string | null>('trigger');

  // Google Sheet URLが設定されているかチェック
  if (!user.googleSheetUrl) {
    return (
      <Container size="lg" py="xl">
        <Paper p="md" withBorder>
          <Alert
            icon={<IconAlertCircle size={16} />}
            title={t('xAccounts.settingsError')}
            color="red"
            variant="filled"
          >
            {t('xAccounts.googleSheetRequired')}
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        {t('navigation.activity')}
      </Title>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="trigger">{t('activity.trigger.title')}</Tabs.Tab>
          <Tabs.Tab value="data">{t('activity.data')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="trigger" pt="md">
          <Trigger />
        </Tabs.Panel>

        <Tabs.Panel value="data" pt="md">
          <SheetData />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default Activity;
