import React, { useEffect, useState } from 'react';
import { IconBroadcast, IconCheck, IconSend, IconStar } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Grid,
  Group,
  Image,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { firebaseApp } from '@/firebase';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  fetchAdminMessageThread,
  fetchAdminMessageThreads,
  markAdminThreadRead,
  selectAdminThreadLocally,
  sendAdminBroadcast,
  sendAdminMessage,
  setIncludePastAdminMessages,
  setMessageImportant,
  type MessageThread,
} from '@/store/reducers/messagesSlice';

const formatDateTime = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleString(locale) : '';

const AdminMessages: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const dispatch = useAppDispatch();
  const {
    adminThreads,
    selectedAdminThread,
    selectedAdminMessages,
    includePastAdminMessages,
    sending,
    error,
  } =
    useAppSelector((state) => state.messages);
  const [directBody, setDirectBody] = useState('');
  const [directFiles, setDirectFiles] = useState<File[]>([]);
  const [directImportant, setDirectImportant] = useState(false);
  const [manualUserEmail, setManualUserEmail] = useState('');
  const [resolvedUserUid, setResolvedUserUid] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  useEffect(() => {
    dispatch(fetchAdminMessageThreads());
  }, [dispatch]);

  const selectedUserUid = selectedAdminThread?.userUid || resolvedUserUid;
  const filteredThreads = adminThreads.filter((thread) => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [thread.userDisplayName, thread.userEmail, thread.userUid, thread.latestMessageText]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const handleSelectThread = async (userUid: string) => {
    const localThread = adminThreads.find((thread) => thread.userUid === userUid) ?? null;
    dispatch(selectAdminThreadLocally(localThread));
    await dispatch(fetchAdminMessageThread({ userUid, includePast: includePastAdminMessages }));
    await dispatch(markAdminThreadRead({ userUid }));
  };

  const handleLoadManualUser = async () => {
    const email = manualUserEmail.trim();
    if (!email) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.inputError'),
        message: t('admin.messages.enterEmail'),
      });
      return;
    }

    setSearchingUser(true);
    try {
      // メールアドレスから Firebase UID を解決する（管理者専用 callable）。
      const findUserUidByEmail = httpsCallable<
        { email: string },
        { uid: string; email: string; displayName: string }
      >(getFunctions(firebaseApp, 'asia-northeast1'), 'findUserUidByEmail');
      const result = await findUserUidByEmail({ email });
      const userUid = result.data.uid;
      setResolvedUserUid(userUid);

      const existingThread = adminThreads.find((thread) => thread.userUid === userUid);
      if (existingThread) {
        dispatch(selectAdminThreadLocally(existingThread));
      } else {
        const resolvedThread: MessageThread = {
          id: userUid,
          userUid,
          userEmail: result.data.email,
          userDisplayName: result.data.displayName,
          latestMessageText: '',
          latestMessageAt: null,
          latestSenderRole: '',
          userUnreadCount: 0,
          adminUnreadCount: 0,
          hasImportant: false,
          updatedAt: new Date().toISOString(),
        };
        dispatch(selectAdminThreadLocally(resolvedThread));
      }

      await dispatch(fetchAdminMessageThread({ userUid, includePast: includePastAdminMessages }));
    } catch (error: any) {
      setResolvedUserUid('');
      dispatch(selectAdminThreadLocally(null));
      notifications.show({
        color: 'red',
        title: t('admin.messages.searchError'),
        message:
          error?.message || t('admin.messages.userNotFound'),
      });
    } finally {
      setSearchingUser(false);
    }
  };

  const handleSendDirect = async () => {
    const userUid = selectedUserUid;
    const body = directBody.trim();
    if (!userUid || !body) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.inputError'),
        message: t('admin.messages.enterRecipientAndBody'),
      });
      return;
    }

    try {
      await dispatch(
        sendAdminMessage({
          userUid,
          body,
          files: directFiles,
          isImportant: directImportant,
        })
      ).unwrap();
      setDirectBody('');
      setDirectFiles([]);
      setDirectImportant(false);
      notifications.show({
        color: 'green',
        title: t('admin.messages.sent'),
        message: t('admin.messages.sentMessage'),
        icon: <IconCheck size="1rem" />,
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.sendError'),
        message: typeof err === 'string' ? err : t('admin.messages.sendFailed'),
      });
    }
  };

  const handleSendBroadcast = async () => {
    const subject = broadcastSubject.trim();
    const body = broadcastBody.trim();
    if (!subject || !body) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.inputError'),
        message: t('admin.messages.enterSubjectAndBody'),
      });
      return;
    }

    try {
      await dispatch(sendAdminBroadcast({ subject, body })).unwrap();
      setBroadcastSubject('');
      setBroadcastBody('');
      notifications.show({
        color: 'green',
        title: t('admin.messages.broadcastCreated'),
        message: t('admin.messages.broadcastCreatedMessage'),
        icon: <IconCheck size="1rem" />,
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.createError'),
        message: typeof err === 'string' ? err : t('admin.messages.broadcastFailed'),
      });
    }
  };

  return (
    <Paper p="md" shadow="xs">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('admin.messages.title')}</Title>
        <Button variant="light" onClick={() => dispatch(fetchAdminMessageThreads())}>
          {t('admin.messages.refresh')}
        </Button>
      </Group>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Tabs defaultValue="direct">
        <Tabs.List>
          <Tabs.Tab value="direct">{t('admin.messages.direct')}</Tabs.Tab>
          <Tabs.Tab value="broadcast">{t('admin.messages.broadcast')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="direct" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack>
                <TextInput
                  label={t('admin.messages.userEmailSearch')}
                  placeholder="user@example.com"
                  type="email"
                  value={manualUserEmail}
                  onChange={(event) => setManualUserEmail(event.currentTarget.value)}
                />
                <Button variant="light" onClick={handleLoadManualUser} loading={searchingUser}>
                  {t('admin.messages.openHistory')}
                </Button>
                <TextInput
                  label={t('admin.messages.searchUnread')}
                  placeholder={t('admin.messages.searchPlaceholder')}
                  value={searchText}
                  onChange={(event) => setSearchText(event.currentTarget.value)}
                />
                <ScrollArea h={560} type="auto">
                  <Stack gap="xs">
                    {filteredThreads.length === 0 && (
                      <Text c="dimmed" size="sm">
                        {t('admin.messages.noUnread')}
                      </Text>
                    )}
                    {filteredThreads.map((thread) => (
                      <Card
                        key={thread.userUid}
                        withBorder
                        p="sm"
                        radius="md"
                        style={{ cursor: 'pointer' }}
                        bg={selectedAdminThread?.userUid === thread.userUid ? 'blue.0' : undefined}
                        onClick={() => handleSelectThread(thread.userUid)}
                      >
                        <Group justify="space-between" gap="xs">
                          <Text fw={700} lineClamp={1}>
                            {thread.userDisplayName || thread.userEmail || thread.userUid}
                          </Text>
                          {thread.adminUnreadCount > 0 && (
                            <Badge color="red">{thread.adminUnreadCount}</Badge>
                          )}
                          {thread.hasImportant && <Badge color="yellow">{t('admin.messages.important')}</Badge>}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {thread.userEmail || thread.userUid}
                        </Text>
                        <Text size="sm" lineClamp={2} mt={4}>
                          {thread.latestMessageText}
                        </Text>
                        <Text size="xs" c="dimmed" mt={4}>
                          {formatDateTime(thread.latestMessageAt, locale)}
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack>
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Title order={4}>
                        {selectedAdminThread?.userDisplayName ||
                          selectedAdminThread?.userEmail ||
                          selectedUserUid ||
                          t('admin.messages.noUserSelected')}
                      </Title>
                      {selectedUserUid && (
                        <Text size="xs" c="dimmed">
                          UID: {selectedUserUid}
                        </Text>
                      )}
                    </Stack>
                  </Group>
                </Card>
                <ScrollArea h={360} type="auto">
                  <Stack gap="sm" pr="sm">
                    {selectedAdminMessages.length === 0 && (
                      <Text c="dimmed">{t('admin.messages.noHistory')}</Text>
                    )}
                    {selectedAdminMessages.map((message) => {
                      const isAdmin = message.senderRole === 'admin';
                      return (
                        <Card
                          key={message.id}
                          withBorder
                          p="sm"
                          radius="md"
                          ml={isAdmin ? 'xl' : 0}
                          mr={isAdmin ? 0 : 'xl'}
                          bg={isAdmin ? 'blue.0' : undefined}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Badge color={isAdmin ? 'blue' : 'grape'}>
                                {isAdmin ? t('admin.messages.admin') : t('admin.messages.user')}
                              </Badge>
                              {message.isImportant && (
                                <Badge color="yellow" leftSection={<IconStar size="0.8rem" />}>
                                  {t('admin.messages.important')}
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {t('admin.messages.sentAt', { date: formatDateTime(message.createdAt, locale) })}
                            </Text>
                          </Group>
                          <Text mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
                            {message.body}
                          </Text>
                          {message.attachments.length > 0 && (
                            <Group mt="sm" align="flex-start">
                              {message.attachments.map((attachment) => (
                                <a
                                  key={attachment.storagePath}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Image
                                    src={attachment.url}
                                    alt={attachment.name}
                                    w={150}
                                    h={96}
                                    fit="cover"
                                    radius="sm"
                                  />
                                </a>
                              ))}
                            </Group>
                          )}
                          <Group justify="space-between" mt="xs">
                            <Text size="xs" c="dimmed">
                              {message.readAt
                                ? t('admin.messages.readAt', {
                                    date: formatDateTime(message.readAt, locale),
                                  })
                                : t('admin.messages.unread')}
                            </Text>
                            <Button
                              size="xs"
                              variant={message.isImportant ? 'filled' : 'light'}
                              color="yellow"
                              leftSection={<IconStar size="0.9rem" />}
                              onClick={() =>
                                selectedUserUid &&
                                dispatch(
                                  setMessageImportant({
                                    userUid: selectedUserUid,
                                    messageId: message.id,
                                    isImportant: !message.isImportant,
                                    includePast: includePastAdminMessages,
                                  })
                                )
                              }
                            >
                              {message.isImportant
                                ? t('admin.messages.removeImportant')
                                : t('admin.messages.important')}
                            </Button>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </ScrollArea>
                {!includePastAdminMessages && (
                  <Group justify="center">
                    <Button
                      variant="subtle"
                      onClick={() => {
                        dispatch(setIncludePastAdminMessages(true));
                        if (selectedUserUid) {
                          dispatch(
                            fetchAdminMessageThread({ userUid: selectedUserUid, includePast: true })
                          );
                        }
                      }}
                    >
                      {t('admin.messages.viewPast')}
                    </Button>
                  </Group>
                )}
                <Textarea
                  label={t('admin.messages.sendToUser')}
                  placeholder={t('admin.messages.messageBody')}
                  value={directBody}
                  onChange={(event) => setDirectBody(event.currentTarget.value)}
                  minRows={4}
                  maxLength={5000}
                  autosize
                />
                <FileInput
                  label={t('admin.messages.attachScreenshot')}
                  placeholder={t('admin.messages.chooseImages')}
                  accept="image/*"
                  multiple
                  value={directFiles}
                  onChange={setDirectFiles}
                  clearable
                />
                <Checkbox
                  label={t('admin.messages.sendAsImportant')}
                  checked={directImportant}
                  onChange={(event) => setDirectImportant(event.currentTarget.checked)}
                />
                <Group justify="flex-end">
                  <Button
                    leftSection={<IconSend size="1rem" />}
                    onClick={handleSendDirect}
                    loading={sending}
                    disabled={!selectedUserUid}
                  >
                    {t('admin.messages.send')}
                  </Button>
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="broadcast" pt="md">
          <Stack maw={720}>
            <Alert color="yellow">
              {t('admin.messages.broadcastNotice')}
            </Alert>
            <TextInput
              label={t('admin.messages.subject')}
              value={broadcastSubject}
              onChange={(event) => setBroadcastSubject(event.currentTarget.value)}
              maxLength={120}
              required
            />
            <Textarea
              label={t('admin.messages.body')}
              value={broadcastBody}
              onChange={(event) => setBroadcastBody(event.currentTarget.value)}
              minRows={6}
              maxLength={5000}
              autosize
              required
            />
            <Group justify="flex-end">
              <Button
                leftSection={<IconBroadcast size="1rem" />}
                onClick={handleSendBroadcast}
                loading={sending}
              >
                {t('admin.messages.createBroadcast')}
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
};

export default AdminMessages;
