import React, { useMemo, useState } from 'react';
import {
  IconAlertCircle,
  IconCheck,
  IconLock,
  IconLockOpen,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

type AdminAccountUser = {
  uid: string;
  email: string | null;
  displayName: string;
  disabled: boolean;
  emailVerified: boolean;
  creationTime: string;
  lastSignInTime: string;
};

type GetAdminUserAccountResponse = {
  success: boolean;
  user: AdminAccountUser;
};

type SetAdminUserDisabledResponse = {
  success: boolean;
  message: string;
  user: AdminAccountUser;
};

type DeleteAdminUserAccountResponse = {
  success: boolean;
  message: string;
  uid: string;
  email: string;
};

const getAdminFunctionUrl = (functionName: string) => {
  const projectId = getApp().options.projectId;
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    return `http://localhost:5001/${projectId}/asia-northeast1/${functionName}`;
  }
  return `https://asia-northeast1-${projectId}.cloudfunctions.net/${functionName}`;
};

const AdminAccountsLock: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [user, setUser] = useState<AdminAccountUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    'search' | 'disable' | 'enable' | 'delete' | null
  >(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canDelete =
    !!user && !!user.email && deleteConfirmation.trim().toLowerCase() === user.email.toLowerCase();

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      return err.message;
    }
    return fallback;
  };

  const callAdminFunction = async <TResponse,>(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<TResponse> => {
    const token = await getAuth(getApp()).currentUser?.getIdToken();
    if (!token) {
      throw new Error(t('admin.accounts.authRequired'));
    }

    const response = await fetch(getAdminFunctionUrl(functionName), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || t('admin.accounts.operationFailed'));
    }

    if (data === null) {
      throw new Error(t('admin.accounts.invalidResponse'));
    }

    return data as TResponse;
  };

  const handleSearch = async () => {
    setLoadingAction('search');
    setError(null);
    setUser(null);
    setDeleteConfirmation('');

    try {
      const result = await callAdminFunction<GetAdminUserAccountResponse>(
        'getAdminUserAccountByEmail',
        { email: normalizedEmail }
      );
      setUser(result.user);
    } catch (err) {
      const message = getErrorMessage(err, t('admin.accounts.loadFailed'));
      setError(message);
      notifications.show({
        color: 'red',
        title: t('admin.accounts.searchError'),
        message,
        icon: <IconAlertCircle size="1rem" />,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetDisabled = async (disabled: boolean) => {
    if (!user) {
      return;
    }

    const action = disabled ? 'disable' : 'enable';
    setLoadingAction(action);
    setError(null);

    try {
      if (!user.email) {
        throw new Error(t('admin.accounts.noEmailOperation'));
      }
      const result = await callAdminFunction<SetAdminUserDisabledResponse>(
        'setAdminUserDisabledByEmail',
        { email: user.email, disabled }
      );
      setUser(result.user);
      notifications.show({
        color: disabled ? 'orange' : 'teal',
        title: disabled ? t('admin.accounts.disabled') : t('admin.accounts.enabled'),
        message: result.message,
        icon: <IconCheck size="1rem" />,
      });
    } catch (err) {
      const message = getErrorMessage(err, t('admin.accounts.statusUpdateFailed'));
      setError(message);
      notifications.show({
        color: 'red',
        title: t('admin.accounts.updateError'),
        message,
        icon: <IconAlertCircle size="1rem" />,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const deleteUserAccount = async () => {
    if (!user || !canDelete) {
      return;
    }

    setLoadingAction('delete');
    setError(null);

    try {
      if (!user.email) {
        throw new Error(t('admin.accounts.noEmailDelete'));
      }
      const result = await callAdminFunction<DeleteAdminUserAccountResponse>(
        'deleteAdminUserAccountByEmail',
        { email: user.email }
      );
      notifications.show({
        color: 'teal',
        title: t('admin.accounts.deleteComplete'),
        message: result.message,
        icon: <IconCheck size="1rem" />,
      });
      setUser(null);
      setEmail(result.email);
      setDeleteConfirmation('');
    } catch (err) {
      const message = getErrorMessage(err, t('admin.accounts.deleteFailed'));
      setError(message);
      notifications.show({
        color: 'red',
        title: t('admin.accounts.deleteError'),
        message,
        icon: <IconAlertCircle size="1rem" />,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = () => {
    if (!user || !canDelete) {
      return;
    }

    modals.openConfirmModal({
      title: t('admin.accounts.deleteAccount'),
      children: (
        <Text size="sm">
          {t('admin.accounts.deleteConfirm', {
            email: user.email ?? t('admin.accounts.noEmail'),
          })}
        </Text>
      ),
      labels: { confirm: t('common.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteUserAccount();
      },
    });
  };

  return (
    <Paper p="md" shadow="xs">
      <Stack gap="md">
        <Title order={2}>{t('admin.accounts.title')}</Title>

        <Group align="end">
          <TextInput
            label={t('auth.email')}
            placeholder="user@example.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && normalizedEmail) {
                handleSearch();
              }
            }}
            style={{ flex: 1, minWidth: 260 }}
          />
          <Button
            leftSection={<IconSearch size="1rem" />}
            onClick={handleSearch}
            loading={loadingAction === 'search'}
            disabled={!normalizedEmail || !!loadingAction}
          >
            {t('common.search')}
          </Button>
        </Group>

        {error && (
          <Alert title={t('common.error')} color="red" icon={<IconAlertCircle />}>
            {error}
          </Alert>
        )}

        {user && (
          <Stack gap="md">
            <Table.ScrollContainer minWidth={720}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>UID</Table.Th>
                    <Table.Th>{t('admin.accounts.email')}</Table.Th>
                    <Table.Th>{t('admin.accounts.displayName')}</Table.Th>
                    <Table.Th>{t('admin.accounts.authStatus')}</Table.Th>
                    <Table.Th>{t('admin.accounts.emailVerification')}</Table.Th>
                    <Table.Th>{t('admin.accounts.createdAt')}</Table.Th>
                    <Table.Th>{t('admin.accounts.lastSignIn')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>{user.uid}</Table.Td>
                    <Table.Td>{user.email ?? '-'}</Table.Td>
                    <Table.Td>{user.displayName || '-'}</Table.Td>
                    <Table.Td>
                      <Badge color={user.disabled ? 'red' : 'teal'}>
                        {user.disabled ? t('admin.accounts.suspended') : t('common.enabled')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={user.emailVerified ? 'teal' : 'gray'}>
                        {user.emailVerified
                          ? t('admin.accounts.verified')
                          : t('admin.accounts.unverified')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.creationTime || '-'}</Table.Td>
                    <Table.Td>{user.lastSignInTime || '-'}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group>
              {user.disabled ? (
                <Button
                  color="teal"
                  leftSection={<IconLockOpen size="1rem" />}
                  onClick={() => handleSetDisabled(false)}
                  loading={loadingAction === 'enable'}
                  disabled={!!loadingAction}
                >
                  {t('admin.accounts.enable')}
                </Button>
              ) : (
                <Button
                  color="orange"
                  leftSection={<IconLock size="1rem" />}
                  onClick={() => handleSetDisabled(true)}
                  loading={loadingAction === 'disable'}
                  disabled={!!loadingAction}
                >
                  {t('admin.accounts.disable')}
                </Button>
              )}
            </Group>

            <Stack gap="xs">
              <Text fw={600}>{t('admin.accounts.deleteAccount')}</Text>
              <Group align="end">
                <TextInput
                  label={t('admin.accounts.deleteVerification')}
                  placeholder={user.email ?? ''}
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.currentTarget.value)}
                  style={{ flex: 1, minWidth: 260 }}
                />
                <Button
                  color="red"
                  leftSection={<IconTrash size="1rem" />}
                  onClick={handleDelete}
                  loading={loadingAction === 'delete'}
                  disabled={!canDelete || !!loadingAction}
                >
                  {t('admin.accounts.deleteAccount')}
                </Button>
              </Group>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

export default AdminAccountsLock;
