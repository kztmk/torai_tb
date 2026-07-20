import { Button, Group, Paper, Stack, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface KeywordPanelProps {
  keyword: string;
  setKeyword: (keyword: string) => void;
  onGenerate: () => void;
  loading: boolean;
}

function KeywordPanel({ keyword, setKeyword, onGenerate, loading }: KeywordPanelProps) {
  const { t } = useTranslation();
  return (
    <Paper shadow="xs" p="md">
      <Stack>
        <Title order={3}>{t('xPosts.generator.step1')}</Title>
        <Group grow>
          <TextInput
            placeholder={t('xPosts.generator.keywordPlaceholder')}
            value={keyword}
            onChange={(event) => setKeyword(event.currentTarget.value)}
            disabled={loading}
            style={{ flexGrow: 1 }}
            data-autofocus // ページロード時にフォーカス
          />
          <Button onClick={onGenerate} loading={loading} disabled={!keyword.trim()}>
            {t('xPosts.generator.generate')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default KeywordPanel;
