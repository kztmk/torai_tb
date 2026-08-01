/**
 * アカウント別の投稿画面（Phase 9）。
 * ツリーの枝から遷移。そのアカウントの「予約・キュー / 投稿済み / エラー」をタブで表示する。
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { IconAlertTriangle, IconChecks, IconClipboardList, IconRefresh } from '@tabler/icons-react';
import { Badge, Button, Group, Stack, Tabs, Title } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { fetchAccounts, selectAccounts } from '@/store/reducers/accountsSlice';
import { fetchPostLists, selectPosts } from '@/store/reducers/postsSlice';
import type { Platform } from '@/types/accounts';
import ErrorsList from './ErrorsList';
import PostList from './PostList';
import PostedList from './PostedList';

const PostsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { platform, accountId } = useParams<{ platform: Platform; accountId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const { bluesky, threads } = useAppSelector(selectAccounts);
  const { queued, posted, errors, listLoading } = useAppSelector(selectPosts);

  useEffect(() => {
    if (user.gasProxyInitializedAt && bluesky.length === 0 && threads.length === 0) {
      dispatch(fetchAccounts());
    }
  }, [dispatch, user.gasProxyInitializedAt, bluesky.length, threads.length]);

  useEffect(() => {
    if (user.gasProxyInitializedAt) {
      dispatch(fetchPostLists());
    }
  }, [dispatch, user.gasProxyInitializedAt]);

  const account =
    platform === 'threads'
      ? threads.find((a) => a.accountId === accountId)
      : bluesky.find((a) => a.accountId === accountId);

  const postedCount =
    platform && accountId
      ? posted.filter((p) => p.platform === platform && p.accountId === accountId).length
      : 0;

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={2}>{account?.displayName || `@${accountId}`}</Title>
          <Badge variant="light" color={platform === 'threads' ? 'grape' : 'blue'}>
            {platform}
          </Badge>
        </Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconRefresh size={16} />}
          loading={listLoading}
          onClick={() => dispatch(fetchPostLists())}
        >
          {t('accounts.refresh')}
        </Button>
      </Group>

      <Tabs defaultValue="queued" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="queued" leftSection={<IconClipboardList size={16} />}>
            {t('postList.queuedTitle')}
          </Tabs.Tab>
          <Tabs.Tab
            value="posted"
            leftSection={<IconChecks size={16} />}
            rightSection={
              postedCount > 0 ? (
                <Badge size="xs" variant="light" circle>
                  {postedCount}
                </Badge>
              ) : null
            }
          >
            {t('posted.title')}
          </Tabs.Tab>
          <Tabs.Tab
            value="errors"
            leftSection={<IconAlertTriangle size={16} />}
            rightSection={
              errors.length > 0 ? (
                <Badge size="xs" color="red" variant="light" circle>
                  {errors.length}
                </Badge>
              ) : null
            }
          >
            {t('errors.title')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queued" pt="md">
          {platform && accountId && (
            <PostList platform={platform} accountId={accountId} posts={queued} />
          )}
        </Tabs.Panel>
        <Tabs.Panel value="posted" pt="md">
          {platform && accountId && (
            <PostedList platform={platform} accountId={accountId} posted={posted} />
          )}
        </Tabs.Panel>
        <Tabs.Panel value="errors" pt="md">
          <ErrorsList errors={errors} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};

export default PostsPage;
