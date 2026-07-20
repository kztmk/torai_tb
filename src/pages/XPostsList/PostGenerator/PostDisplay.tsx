import React from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { PostData } from '@/store/reducers/generatedPostsSlice'; // PostData 型をインポート
import { useTranslation } from 'react-i18next';

interface PostDisplayProps {
  posts: PostData[];
  onTextChange: (id: string, newText: string) => void;
  onAdoptionChange: (id: string, checked: boolean) => void;
  onImport: () => void; // 追加: 採用したポストを取込む関数
}

function PostDisplay({ posts, onTextChange, onAdoptionChange, onImport }: PostDisplayProps) {
  const { t } = useTranslation();
  const adoptedCount = posts.filter((p) => p.adopted).length;

  return (
    <Paper shadow="xs" p="md" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <Group mb="md">
        <Title order={3}>{t('xPosts.generator.step2', { count: posts.length })}</Title>
        <Text size="sm" c="dimmed">
          {t('xPosts.generator.adopted', { count: adoptedCount })}
        </Text>
      </Group>
      <Button disabled={!adoptedCount} variant="outline" color="blue" size="xs" onClick={onImport}>
        {t('xPosts.generator.import')}
      </Button>
      {/* ビューポートの高さから他の要素の高さを引いて調整 */}
      <ScrollArea style={{ height: 'calc(100vh - 350px)', flexGrow: 1 }}>
        <Stack gap="sm">
          {posts.map((post) => (
            <Card key={post.id} shadow="sm" padding="sm" radius="md" withBorder>
              <Group align="flex-start">
                <Textarea
                  value={post.text}
                  onChange={(event) => onTextChange(post.id, event.currentTarget.value)}
                  autosize // 自動で高さを調整
                  minRows={2} // 最低2行表示
                  maxRows={8} // 最大8行まで自動調整
                  styles={{ input: { lineHeight: 1.4 } }} // 行間を少し調整
                  style={{ flexGrow: 1, marginRight: '1rem' }} // チェックボックスとのスペース
                />
                <Box pt={5}>
                  {' '}
                  {/* チェックボックスを少し下に配置 */}
                  <Checkbox
                    aria-label={t('xPosts.generator.adoptPost', { count: Number(post.id) + 1 })} // アクセシビリティのためのラベル
                    checked={post.adopted}
                    onChange={(event) => onAdoptionChange(post.id, event.currentTarget.checked)}
                  />
                </Box>
              </Group>
            </Card>
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

export default PostDisplay;
