import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import {
  IconAlertTriangle,
  IconBrandX,
  IconCopy,
  IconCurrencyDollar,
  IconLock,
  IconSparkles,
  IconStar,
  IconUsers,
} from '@tabler/icons-react';
import {
  Alert,
  Avatar,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { selectInteraction, selectXMarketing } from '@/store/reducers/xMarketingSlice';
import type { XMarketingDashboard } from '@/types/xMarketing';
import { generateXMarketingReply } from '@/utils/AI/xMarketingReplyApi';
import { normalizeGeminiApiKey } from '@/utils/geminiApiKey';
import { avatarInitial, MarketingHeader, reactionIcon, reactionLabel, Score } from './shared';
import classes from './XMarketing.module.css';

export default function Inbox({ dashboard }: { dashboard: XMarketingDashboard }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { selectedAccountId, selectedInteractionId } = useAppSelector(selectXMarketing);
  const geminiApiKey = useAppSelector((state) => state.auth.user?.geminiApiKey ?? '');
  const [filter, setFilter] = useState('all');
  const [xConfirmationOpened, setXConfirmationOpened] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const accountInteractions = useMemo(
    () =>
      (dashboard?.interactions || []).filter(
        (v) => selectedAccountId === 'all' || v.accountId === selectedAccountId
      ),
    [dashboard?.interactions, selectedAccountId]
  );
  const interactions = useMemo(
    () => accountInteractions.filter((v) => filter === 'all' || v.reactionType === filter),
    [accountInteractions, filter]
  );
  const selected = interactions.find((v) => v.id === selectedInteractionId) ?? interactions[0];
  const unread = accountInteractions.filter((v) => v.status === 'unread').length;
  const high = accountInteractions.filter((v) => v.score >= 75).length;
  const estimatedCost =
    selectedAccountId === 'all'
      ? (dashboard?.globalCost?.estimatedUsd ?? 0)
      : (dashboard?.accounts?.find((account) => account.accountId === selectedAccountId)
          ?.estimatedCostUsd ?? 0);
  useEffect(() => {
    setSuggestedReply('');
    setXConfirmationOpened(false);
  }, [selected?.id]);

  const createSuggestedReply = async () => {
    if (selected === undefined) {
      return;
    }
    const apiKey = normalizeGeminiApiKey(geminiApiKey);
    if (apiKey === '') {
      notifications.show({
        color: 'red',
        title: t('xMarketing.inbox.geminiMissing'),
        message: t('xMarketing.inbox.geminiMissingMessage'),
      });
      return;
    }

    setIsGeneratingReply(true);
    try {
      const reply = await generateXMarketingReply(apiKey, selected);
      setSuggestedReply(reply);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('xMarketing.inbox.replyFailed'),
        message:
          error instanceof Error && error.message !== ''
            ? error.message
            : t('xMarketing.errors.tryAgain'),
      });
    } finally {
      setIsGeneratingReply(false);
    }
  };
  const copySuggestedReply = async () => {
    if (typeof navigator.clipboard === 'undefined') {
      notifications.show({
        color: 'red',
        title: t('xMarketing.inbox.copyFailed'),
        message: t('xMarketing.inbox.clipboardUnsupported'),
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(suggestedReply);
      notifications.show({
        color: 'green',
        title: t('xMarketing.inbox.copied'),
        message: t('xMarketing.inbox.copiedMessage'),
      });
    } catch {
      notifications.show({
        color: 'red',
        title: t('xMarketing.inbox.copyFailed'),
        message: t('xMarketing.inbox.clipboardPermission'),
      });
    }
  };
  return (
    <div className={classes.page}>
      <MarketingHeader
        title={t('xMarketing.inbox.title')}
        description={t('xMarketing.inbox.description')}
        dashboard={dashboard}
        accountId={selectedAccountId}
      />
      <section className={classes.summary}>
        {[
          { label: t('xMarketing.inbox.unread'), value: unread, icon: <IconBrandX /> },
          { label: t('xMarketing.inbox.highPriority'), value: high, icon: <IconStar /> },
          { label: t('xMarketing.inbox.newResponders'), value: accountInteractions.length, icon: <IconUsers /> },
          {
            label: t('xMarketing.inbox.monthlyEstimate'),
            value: `$${estimatedCost.toFixed(2)}`,
            icon: <IconCurrencyDollar />,
          },
        ].map(({ label, value, icon }) => (
          <div className={classes.summaryItem} key={label}>
            <div className={classes.iconBox}>{icon}</div>
            <div>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text fw={700} size="xl">
                {value}
              </Text>
            </div>
          </div>
        ))}
      </section>
      <div className={classes.workspace}>
        <div className={classes.list}>
          <div className={classes.filters}>
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              data={[
                { label: `${t('common.all')} ${accountInteractions.length}`, value: 'all' },
                { label: t('xMarketing.inbox.question'), value: 'reply' },
                { label: t('xMarketing.inbox.quote'), value: 'quote' },
                { label: t('xMarketing.reactions.like'), value: 'like' },
              ]}
            />
          </div>
          {interactions.length === 0 ? (
            <Alert
              m="md"
              title={
                accountInteractions.length > 0
                  ? t('xMarketing.inbox.noFilteredData')
                  : dashboard.settings.enabled
                    ? t('xMarketing.inbox.noData')
                    : t('xMarketing.inbox.disabled')
              }
            >
              {accountInteractions.length > 0
                ? t('xMarketing.inbox.selectAnotherFilter')
                : dashboard.settings.enabled
                  ? t('xMarketing.waitForRefresh')
                  : t('xMarketing.inbox.enableFromSettings')}
            </Alert>
          ) : (
            interactions.map((item) => (
              <button
                type="button"
                className={classes.row}
                data-selected={item.id === selected?.id}
                key={item.id}
                onClick={() => dispatch(selectInteraction(item.id))}
              >
                <span className={classes.iconBox}>{reactionIcon(item.reactionType)}</span>
                <Avatar color="palePurple" radius="xl">
                  {avatarInitial(item.name)}
                </Avatar>
                <div>
                  <Text fw={600} truncate>
                    {item.name}{' '}
                    <Text span size="xs" c="dimmed">
                      @{item.username}
                    </Text>
                  </Text>
                  <Text size="sm" fw={500}>
                    {reactionLabel(item.reactionType, t)}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {item.postText}
                  </Text>
                </div>
                <Score interaction={item} />
                <Text className={classes.rowTime} size="xs" c="dimmed">
                  {formatRelative(item.occurredAt, t)}
                </Text>
              </button>
            ))
          )}
        </div>
        {selected !== undefined && (
          <aside className={classes.detail}>
            <Group>
              <Avatar size="lg" color="palePurple">
                {avatarInitial(selected.name)}
              </Avatar>
              <div>
                <Text fw={700}>{selected.name}</Text>
                <Text size="xs" c="dimmed">
                  @{selected.username}
                </Text>
              </div>
            </Group>
            <Title order={4} mt="lg">
              {t('xMarketing.inbox.history')}
            </Title>
            <Stack gap="xs" mt="sm">
              <History text={reactionLabel(selected.reactionType, t)} detail={selected.postText} />
              <History
                text={t('xMarketing.inbox.pastEngagement')}
                detail={t('xMarketing.counts', {
                  likes: selected.counts?.likes ?? 0,
                  replies: selected.counts?.replies ?? 0,
                  quotes: selected.counts?.quotes ?? 0,
                })}
              />
            </Stack>
            {selected.score >= 75 && (
              <>
                <Title order={4} mt="lg">
                  {t('xMarketing.inbox.whyHighPriority')}
                </Title>
                <Text size="sm" mt="xs">
                  {t('xMarketing.inbox.highPriorityReason')}
                </Text>
              </>
            )}
            <Title order={4} mt="lg">
              {t('xMarketing.inbox.aiReply')}
            </Title>
            <Button
              variant="outline"
              fullWidth
              mt="xs"
              loading={isGeneratingReply}
              leftSection={<IconSparkles size={16} />}
              onClick={createSuggestedReply}
            >
              {suggestedReply !== ''
                ? t('xMarketing.inbox.regenerateReply')
                : t('xMarketing.inbox.generateReply')}
            </Button>
            {suggestedReply !== '' && (
              <>
                <Textarea
                  mt="xs"
                  minRows={4}
                  value={suggestedReply}
                  onChange={(event) => setSuggestedReply(event.currentTarget.value)}
                  aria-label={t('xMarketing.inbox.aiReply')}
                />
                <Button
                  variant="outline"
                  fullWidth
                  mt="xs"
                  leftSection={<IconCopy size={16} />}
                  onClick={copySuggestedReply}
                >
                  {t('xMarketing.inbox.copyReply')}
                </Button>
                <Text size="xs" c="dimmed" mt="xs">
                  {t('xMarketing.inbox.reviewAi')}
                </Text>
              </>
            )}
            <div className={classes.policy}>
              <Group gap="xs" align="flex-start">
                <IconLock size={16} />
                <Text size="xs">
                  {t('xMarketing.inbox.noAutomation')}
                </Text>
              </Group>
            </div>
            <div className={classes.xAccountNotice}>
              <Group gap="xs" align="flex-start" wrap="nowrap">
                <IconAlertTriangle size={17} />
                <Text size="xs">
                  {t('xMarketing.inbox.confirmAccountPrefix')}{' '}
                  <strong>@{selected.accountId}</strong>{' '}
                  {t('xMarketing.inbox.confirmAccountSuffix')}
                </Text>
              </Group>
            </div>
            <Button
              fullWidth
              mt="sm"
              leftSection={<IconBrandX size={17} />}
              onClick={() => setXConfirmationOpened(true)}
            >
              {t('xMarketing.inbox.openX')}
            </Button>
            <Modal
              opened={xConfirmationOpened}
              onClose={() => setXConfirmationOpened(false)}
              title={t('xMarketing.inbox.confirmXAccount')}
              centered
            >
              <Stack>
                <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
                  {t('xMarketing.inbox.responseAccountPrefix')}{' '}
                  <strong>@{selected.accountId}</strong>.
                </Alert>
                <Text size="sm">
                  {t('xMarketing.inbox.browserAccountNotice')}
                </Text>
                <Group justify="flex-end">
                  <Button variant="default" onClick={() => setXConfirmationOpened(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    component="a"
                    href={
                      selected.reactionType === 'follow' || selected.postId === ''
                        ? `https://x.com/${selected.username}`
                        : `https://x.com/${selected.username}/status/${selected.postId}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    leftSection={<IconBrandX size={17} />}
                    onClick={() => setXConfirmationOpened(false)}
                  >
                    {t('xMarketing.inbox.openXAs', { account: selected.accountId })}
                  </Button>
                </Group>
              </Stack>
            </Modal>
          </aside>
        )}
      </div>
    </div>
  );
}
function History({ text, detail }: { text: string; detail: string }) {
  return (
    <div>
      <Text fw={600} size="sm">
        {text}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2}>
        {detail}
      </Text>
    </div>
  );
}
function formatRelative(value: string, t: TFunction) {
  if (value === '') {
    return '';
  }
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) {
    return '';
  }
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) {
    return t('xMarketing.relative.minutes', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? t('xMarketing.relative.hours', { count: hours })
    : t('xMarketing.relative.days', { count: Math.floor(hours / 24) });
}
