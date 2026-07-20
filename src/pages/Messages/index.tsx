import React, { useEffect, useState } from 'react';
import { IconCheck, IconMailOpened, IconSend, IconStar } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Center,
  FileInput,
  Group,
  Image,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  markBroadcastRead,
  markDirectMessagesRead,
  sendUserMessage,
  setIncludePastUserMessages,
} from '@/store/reducers/messagesSlice';

const formatDateTime = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleString(locale) : '';

const LoadingMessages = () => {
  const { t } = useTranslation();
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{t('messages.loading')}</Text>
      </Stack>
    </Center>
  );
};

const MessagesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const dispatch = useAppDispatch();
  const {
    directMessages,
    broadcastMessages,
    unreadDirectCount,
    includePastUserMessages,
    loading,
    sending,
    error,
  } = useAppSelector((state) => state.messages);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isImportant, setIsImportant] = useState(false);
  const isLoadingMessages = loading === 'pending';

  useEffect(() => {
    dispatch(markDirectMessagesRead({ includePast: includePastUserMessages }));
  }, [dispatch, includePastUserMessages]);

  const handleSend = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      notifications.show({
        color: 'red',
        title: t('admin.messages.inputError'),
        message: t('messages.enterBody'),
      });
      return;
    }

    try {
      await dispatch(sendUserMessage({ body: trimmedBody, files, isImportant })).unwrap();
      setBody('');
      setFiles([]);
      setIsImportant(false);
      notifications.show({
        color: 'green',
        title: t('admin.messages.sent'),
        message: t('messages.sentToAdmin'),
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

  return (
    <Paper p={{ base: 'md', sm: 'xl' }}>
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('navigation.messages')}</Title>
        {unreadDirectCount > 0 && <Badge color="red">{t('header.unread', { count: unreadDirectCount })}</Badge>}
      </Group>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <Tabs defaultValue="direct">
        <Tabs.List>
          <Tabs.Tab value="direct">{t('messages.directWithAdmin')}</Tabs.Tab>
          <Tabs.Tab value="broadcast">{t('messages.announcements')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="direct" pt="md">
          <Stack>
            <ScrollArea h={420} type="auto">
              <Stack gap="sm" pr="sm">
                {isLoadingMessages && directMessages.length === 0 && <LoadingMessages />}
                {!isLoadingMessages && directMessages.length === 0 && (
                  <Text c="dimmed">{t('messages.noDirect')}</Text>
                )}
                {directMessages.map((message) => {
                  const isMine = message.senderRole === 'user';
                  return (
                    <Card
                      key={message.id}
                      withBorder
                      radius="md"
                      p="md"
                      ml={isMine ? 'xl' : 0}
                      mr={isMine ? 0 : 'xl'}
                      bg={isMine ? 'blue.0' : undefined}
                    >
                      <Group justify="space-between" gap="xs">
                        <Group gap="xs">
                          <Badge color={isMine ? 'blue' : 'grape'}>
                            {isMine ? t('messages.you') : t('admin.messages.admin')}
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
                                w={140}
                                h={90}
                                fit="cover"
                                radius="sm"
                              />
                            </a>
                          ))}
                        </Group>
                      )}
                      <Text size="xs" c="dimmed" mt="xs">
                        {message.readAt
                          ? t('admin.messages.readAt', { date: formatDateTime(message.readAt, locale) })
                          : t('admin.messages.unread')}
                      </Text>
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
            {!includePastUserMessages && (
              <Group justify="center">
                <Button
                  variant="subtle"
                  onClick={() => dispatch(setIncludePastUserMessages(true))}
                >
                  {t('admin.messages.viewPast')}
                </Button>
              </Group>
            )}
            <Textarea
              label={t('messages.sendToAdmin')}
              placeholder={t('messages.inquiryPlaceholder')}
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
              minRows={4}
              maxLength={5000}
              autosize
            />
            <FileInput
              label={t('admin.messages.attachScreenshot')}
              placeholder={t('admin.messages.chooseImages')}
              accept="image/*"
              multiple
              value={files}
              onChange={setFiles}
              clearable
            />
            <Checkbox
              label={t('admin.messages.sendAsImportant')}
              checked={isImportant}
              onChange={(event) => setIsImportant(event.currentTarget.checked)}
            />
            <Group justify="flex-end">
              <Button leftSection={<IconSend size="1rem" />} onClick={handleSend} loading={sending}>
                {t('admin.messages.send')}
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="broadcast" pt="md">
          <Stack>
            {isLoadingMessages && broadcastMessages.length === 0 && <LoadingMessages />}
            {!isLoadingMessages && broadcastMessages.length === 0 && (
              <Text c="dimmed">{t('messages.noAnnouncements')}</Text>
            )}
            {broadcastMessages.map((message) => (
              <Card key={message.id} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Title order={4}>{message.subject}</Title>
                      {!message.readAt && <Badge color="red">{t('admin.messages.unread')}</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {t('admin.messages.sentAt', { date: formatDateTime(message.createdAt, locale) })}
                    </Text>
                  </Stack>
                  {!message.readAt && (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconMailOpened size="1rem" />}
                      onClick={() => dispatch(markBroadcastRead({ broadcastId: message.id }))}
                    >
                      {t('messages.markRead')}
                    </Button>
                  )}
                </Group>
                <Text mt="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {message.body}
                </Text>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
};

export default MessagesPage;
