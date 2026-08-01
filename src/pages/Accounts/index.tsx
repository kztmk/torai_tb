/**
 * アカウント管理ページ（Phase 9）。
 * Bluesky（ハンドル＋アプリパスワード）と Threads（App ID/Secret → OAuth 認可）の
 * PlatformAccount を一覧・追加・編集・削除する。GAS の blueskyAuth / threadsAuth を利用。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconEdit,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  clearAuthorizeUrl,
  createBlueskyAccount,
  createThreadsAccount,
  deleteBlueskyAccount,
  deleteThreadsAccount,
  fetchAccounts,
  requestThreadsAuthorizeUrl,
  selectAccounts,
  updateBlueskyAccount,
  updateThreadsAccount,
} from '@/store/reducers/accountsSlice';
import type { BlueskyAccountView, Platform, ThreadsAccountView } from '@/types/accounts';

const AccountsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { platform } = useParams<{ platform?: Platform }>();
  const user = useAppSelector((state) => state.auth.user);
  const { bluesky, threads, authorize, isLoading } = useAppSelector(selectAccounts);

  const showBluesky = !platform || platform === 'bluesky';
  const showThreads = !platform || platform === 'threads';
  const isConnected = Boolean(user.gasProxyInitializedAt);

  useEffect(() => {
    if (isConnected) {
      dispatch(fetchAccounts());
    }
  }, [dispatch, isConnected]);

  if (!isConnected) {
    return (
      <Stack p="md">
        <Title order={2}>{t('accounts.title')}</Title>
        <Alert color="yellow" icon={<IconAlertCircle />} title={t('accounts.notConnectedTitle')}>
          {t('accounts.notConnectedMessage')}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="xl">
      <Group justify="space-between">
        <Title order={2}>{t('accounts.title')}</Title>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => dispatch(fetchAccounts())}
          loading={isLoading}
        >
          {t('accounts.refresh')}
        </Button>
      </Group>

      {showBluesky && <BlueskySection accounts={bluesky} />}
      {showThreads && <ThreadsSection accounts={threads} authorizeState={authorize} />}
    </Stack>
  );
};

export default AccountsPage;

// ---------------------------------------------------------------------------
// Bluesky
// ---------------------------------------------------------------------------

interface BlueskyFormValues {
  accountId: string;
  displayName: string;
  handle: string;
  appPassword: string;
}

const BlueskySection = ({ accounts }: { accounts: BlueskyAccountView[] }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<BlueskyAccountView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<BlueskyFormValues>({
    initialValues: { accountId: '', displayName: '', handle: '', appPassword: '' },
    validate: {
      accountId: (v) => (v.trim() ? null : t('accounts.validation.accountIdRequired')),
      handle: (v) => (v.trim() ? null : t('accounts.validation.handleRequired')),
      appPassword: (v) =>
        editing || v.trim() ? null : t('accounts.validation.appPasswordRequired'),
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ accountId: '', displayName: '', handle: '', appPassword: '' });
    open();
  };

  const openEdit = (account: BlueskyAccountView) => {
    setEditing(account);
    form.setValues({
      accountId: account.accountId,
      displayName: account.displayName,
      handle: account.handle,
      appPassword: '',
    });
    open();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    try {
      if (editing) {
        const payload = {
          accountId: editing.accountId,
          handle: values.handle.trim(),
          displayName: values.displayName,
          ...(values.appPassword.trim() ? { appPassword: values.appPassword.trim() } : {}),
        };
        await dispatch(updateBlueskyAccount(payload)).unwrap();
      } else {
        await dispatch(
          createBlueskyAccount({
            accountId: values.accountId.trim(),
            handle: values.handle.trim(),
            appPassword: values.appPassword.trim(),
            displayName: values.displayName,
          })
        ).unwrap();
      }
      notifications.show({ color: 'green', message: t('accounts.saved') });
      close();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('accounts.saveFailed') });
    } finally {
      setSubmitting(false);
    }
  });

  const confirmDelete = (account: BlueskyAccountView) =>
    modals.openConfirmModal({
      title: t('accounts.deleteTitle'),
      children: <Text size="sm">{t('accounts.deleteConfirm', { name: account.accountId })}</Text>,
      labels: { confirm: t('accounts.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await dispatch(deleteBlueskyAccount(account.accountId)).unwrap();
          notifications.show({ color: 'green', message: t('accounts.deleted') });
        } catch (error: any) {
          notifications.show({
            color: 'red',
            message: error?.message || t('accounts.deleteFailed'),
          });
        }
      },
    });

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Bluesky</Title>
          <Text size="xs" c="dimmed">
            {t('accounts.bluesky.hint')}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {t('accounts.add')}
        </Button>
      </Group>

      {accounts.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('accounts.empty')}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('accounts.field.accountId')}</Table.Th>
                <Table.Th>{t('accounts.bluesky.handle')}</Table.Th>
                <Table.Th>{t('accounts.field.status')}</Table.Th>
                <Table.Th ta="right">{t('accounts.field.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((a) => (
                <Table.Tr key={a.accountId}>
                  <Table.Td>
                    <Text fw={500}>{a.displayName || a.accountId}</Text>
                    <Text size="xs" c="dimmed">
                      {a.accountId}
                    </Text>
                  </Table.Td>
                  <Table.Td>{a.handle}</Table.Td>
                  <Table.Td>
                    {a.hasSession ? (
                      <Badge color="green" leftSection={<IconCircleCheck size={12} />}>
                        {t('accounts.bluesky.sessionActive')}
                      </Badge>
                    ) : (
                      <Badge color="gray" leftSection={<IconCircleDashed size={12} />}>
                        {t('accounts.bluesky.noSession')}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <ActionIcon variant="subtle" onClick={() => openEdit(a)} aria-label="edit">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => confirmDelete(a)}
                        aria-label="delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title={editing ? t('accounts.bluesky.editTitle') : t('accounts.bluesky.addTitle')}
      >
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label={t('accounts.field.accountId')}
              description={t('accounts.field.accountIdHint')}
              disabled={Boolean(editing)}
              {...form.getInputProps('accountId')}
            />
            <TextInput
              label={t('accounts.field.displayName')}
              {...form.getInputProps('displayName')}
            />
            <TextInput
              label={t('accounts.bluesky.handle')}
              placeholder="example.bsky.social"
              {...form.getInputProps('handle')}
            />
            <PasswordInput
              label={t('accounts.bluesky.appPassword')}
              description={editing ? t('accounts.bluesky.appPasswordEditHint') : undefined}
              placeholder={editing ? t('accounts.unchangedPlaceholder') : 'xxxx-xxxx-xxxx-xxxx'}
              {...form.getInputProps('appPassword')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting}>
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

interface ThreadsFormValues {
  accountId: string;
  displayName: string;
  appId: string;
  appSecret: string;
}

const ThreadsSection = ({
  accounts,
  authorizeState,
}: {
  accounts: ThreadsAccountView[];
  authorizeState: ReturnType<typeof selectAccounts>['authorize'];
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [opened, { open, close }] = useDisclosure(false);
  const [authOpened, { open: openAuth, close: closeAuth }] = useDisclosure(false);
  const [editing, setEditing] = useState<ThreadsAccountView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ThreadsFormValues>({
    initialValues: { accountId: '', displayName: '', appId: '', appSecret: '' },
    validate: {
      accountId: (v) => (v.trim() ? null : t('accounts.validation.accountIdRequired')),
      appId: (v) => (v.trim() ? null : t('accounts.validation.appIdRequired')),
      appSecret: (v) => (editing || v.trim() ? null : t('accounts.validation.appSecretRequired')),
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ accountId: '', displayName: '', appId: '', appSecret: '' });
    open();
  };

  const openEdit = (account: ThreadsAccountView) => {
    setEditing(account);
    form.setValues({
      accountId: account.accountId,
      displayName: account.displayName,
      appId: account.appId,
      appSecret: '',
    });
    open();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    try {
      if (editing) {
        await dispatch(
          updateThreadsAccount({
            accountId: editing.accountId,
            appId: values.appId.trim(),
            displayName: values.displayName,
            ...(values.appSecret.trim() ? { appSecret: values.appSecret.trim() } : {}),
          })
        ).unwrap();
      } else {
        await dispatch(
          createThreadsAccount({
            accountId: values.accountId.trim(),
            appId: values.appId.trim(),
            appSecret: values.appSecret.trim(),
            displayName: values.displayName,
          })
        ).unwrap();
      }
      notifications.show({ color: 'green', message: t('accounts.saved') });
      close();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('accounts.saveFailed') });
    } finally {
      setSubmitting(false);
    }
  });

  const confirmDelete = (account: ThreadsAccountView) =>
    modals.openConfirmModal({
      title: t('accounts.deleteTitle'),
      children: <Text size="sm">{t('accounts.deleteConfirm', { name: account.accountId })}</Text>,
      labels: { confirm: t('accounts.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await dispatch(deleteThreadsAccount(account.accountId)).unwrap();
          notifications.show({ color: 'green', message: t('accounts.deleted') });
        } catch (error: any) {
          notifications.show({
            color: 'red',
            message: error?.message || t('accounts.deleteFailed'),
          });
        }
      },
    });

  const startAuthorize = async (account: ThreadsAccountView) => {
    try {
      await dispatch(requestThreadsAuthorizeUrl(account.accountId)).unwrap();
      openAuth();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        message: error?.message || t('accounts.threads.authorizeFailed'),
      });
    }
  };

  const closeAuthorize = () => {
    closeAuth();
    dispatch(clearAuthorizeUrl());
    dispatch(fetchAccounts());
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Threads</Title>
          <Text size="xs" c="dimmed">
            {t('accounts.threads.hint')}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {t('accounts.add')}
        </Button>
      </Group>

      {accounts.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('accounts.empty')}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('accounts.field.accountId')}</Table.Th>
                <Table.Th>{t('accounts.threads.appId')}</Table.Th>
                <Table.Th>{t('accounts.field.status')}</Table.Th>
                <Table.Th ta="right">{t('accounts.field.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((a) => (
                <Table.Tr key={a.accountId}>
                  <Table.Td>
                    <Text fw={500}>{a.displayName || a.accountId}</Text>
                    <Text size="xs" c="dimmed">
                      {a.accountId}
                    </Text>
                  </Table.Td>
                  <Table.Td>{a.appId}</Table.Td>
                  <Table.Td>
                    <Stack gap={2} align="flex-start">
                      {a.authorized ? (
                        <Badge color="green" leftSection={<IconCircleCheck size={12} />}>
                          {t('accounts.threads.authorized')}
                        </Badge>
                      ) : (
                        <Badge color="orange" leftSection={<IconCircleDashed size={12} />}>
                          {t('accounts.threads.notAuthorized')}
                        </Badge>
                      )}
                      {a.authorized && a.username && (
                        <Text size="xs" c="dimmed">
                          @{a.username}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <Button
                        size="xs"
                        variant="light"
                        color={a.authorized ? 'gray' : 'blue'}
                        onClick={() => startAuthorize(a)}
                      >
                        {a.authorized ? t('accounts.threads.reauthorize') : t('accounts.threads.authorize')}
                      </Button>
                      <ActionIcon variant="subtle" onClick={() => openEdit(a)} aria-label="edit">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => confirmDelete(a)}
                        aria-label="delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* 追加/編集モーダル */}
      <Modal
        opened={opened}
        onClose={close}
        title={editing ? t('accounts.threads.editTitle') : t('accounts.threads.addTitle')}
      >
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label={t('accounts.field.accountId')}
              description={t('accounts.field.accountIdHint')}
              disabled={Boolean(editing)}
              {...form.getInputProps('accountId')}
            />
            <TextInput
              label={t('accounts.field.displayName')}
              {...form.getInputProps('displayName')}
            />
            <TextInput label={t('accounts.threads.appId')} {...form.getInputProps('appId')} />
            <PasswordInput
              label={t('accounts.threads.appSecret')}
              description={editing ? t('accounts.threads.appSecretEditHint') : undefined}
              placeholder={editing ? t('accounts.unchangedPlaceholder') : undefined}
              {...form.getInputProps('appSecret')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting}>
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* 認可 URL モーダル */}
      <Modal opened={authOpened} onClose={closeAuthorize} title={t('accounts.threads.authorizeTitle')}>
        <Stack>
          <Text size="sm">{t('accounts.threads.authorizeGuide')}</Text>
          {authorizeState?.redirectUri && (
            <Alert color="blue" variant="light" title={t('accounts.threads.redirectUriTitle')}>
              <Group gap="xs" wrap="nowrap">
                <Text size="xs" style={{ wordBreak: 'break-all' }}>
                  {authorizeState.redirectUri}
                </Text>
                <CopyButton value={authorizeState.redirectUri}>
                  {({ copied, copy }) => (
                    <Button size="compact-xs" variant="light" onClick={copy}>
                      {copied ? t('common.copied') : t('common.copy')}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Alert>
          )}
          <Button
            component="a"
            href={authorizeState?.authorizeUrl}
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconExternalLink size={16} />}
            disabled={!authorizeState?.authorizeUrl}
          >
            {t('accounts.threads.openAuthorize')}
          </Button>
          <Text size="xs" c="dimmed">
            {t('accounts.threads.afterAuthorize')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeAuthorize}>
              {t('accounts.threads.doneAuthorize')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
};
