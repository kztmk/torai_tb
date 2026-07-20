import { useEffect, useMemo, useState } from 'react';
import { IconBrandX, IconDeviceFloppy, IconLock } from '@tabler/icons-react';
import {
  Alert,
  Avatar,
  Button,
  Group,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  selectInteraction,
  selectXMarketing,
  updateXMarketingProspect,
} from '@/store/reducers/xMarketingSlice';
import type { XMarketingDashboard, XMarketingStage } from '@/types/xMarketing';
import { avatarInitial, MarketingHeader, reactionLabel, Score } from './shared';
import classes from './XMarketing.module.css';

export default function Crm({ dashboard }: { dashboard: XMarketingDashboard }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const stages: { id: XMarketingStage; label: string }[] = [
    { id: 'new', label: t('xMarketing.crm.stages.new') },
    { id: 'interested', label: t('xMarketing.crm.stages.interested') },
    { id: 'conversation', label: t('xMarketing.crm.stages.conversation') },
    { id: 'completed', label: t('xMarketing.crm.stages.completed') },
  ];
  const defaultTagOptions = [
    t('xMarketing.crm.tags.socialMedia'),
    t('xMarketing.crm.tags.smallBusiness'),
    t('xMarketing.crm.tags.leadGeneration'),
    t('xMarketing.crm.tags.marketing'),
    t('xMarketing.crm.tags.operations'),
  ];
  const { selectedAccountId, selectedInteractionId, saving } = useAppSelector(selectXMarketing);
  const interactions = useMemo(
    () =>
      (dashboard?.interactions || []).filter(
        (v) => selectedAccountId === 'all' || v.accountId === selectedAccountId
      ),
    [dashboard?.interactions, selectedAccountId]
  );
  const selected = interactions.find((v) => v.id === selectedInteractionId) || interactions[0];
  const [memo, setMemo] = useState(selected?.memo || '');
  const [tags, setTags] = useState<string[]>(selected?.tags || []);
  const [stage, setStage] = useState<XMarketingStage>(selected?.stage || 'new');

  useEffect(() => {
    setMemo(selected?.memo || '');
    setTags(selected?.tags || []);
    setStage(selected?.stage || 'new');
  }, [selected?.id]);

  const tagOptions = Array.from(new Set([...defaultTagOptions, ...tags]));
  const save = async () => {
    if (!selected) {
      return;
    }
    try {
      await dispatch(
        updateXMarketingProspect({
          interactionId: selected.id,
          memo,
          tags,
          stage,
          status: 'handled',
        })
      ).unwrap();
      notifications.show({
        color: 'green',
        title: t('xMarketing.crm.saved'),
        message: t('xMarketing.crm.savedMessage'),
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('xMarketing.crm.saveFailed'),
        message:
          typeof error === 'string' && error !== '' ? error : t('xMarketing.errors.tryAgain'),
      });
    }
  };
  return (
    <div className={classes.page}>
      <MarketingHeader
        title={t('xMarketing.crm.title')}
        description={t('xMarketing.crm.description')}
        dashboard={dashboard}
        accountId={selectedAccountId}
      />
      <div className={classes.workspace}>
        <div className={classes.board}>
          {stages.map((stage) => {
            const items = interactions.filter((v) => v.stage === stage.id);
            return (
              <section className={classes.column} key={stage.id}>
                <div className={classes.columnHeader}>
                  <Text fw={700}>
                    {stage.label} {items.length}
                  </Text>
                </div>
                {items.map((item) => (
                  <button
                    type="button"
                    className={classes.prospect}
                    data-selected={item.id === selected?.id}
                    key={item.id}
                    onClick={() => dispatch(selectInteraction(item.id))}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Avatar size="sm" color="palePurple">
                          {avatarInitial(item.name)}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={600} truncate>
                            {item.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            @{item.username}
                          </Text>
                        </div>
                      </Group>
                      <Score interaction={item} />
                    </Group>
                    <Text size="xs" mt="sm">
                      {t('xMarketing.counts', {
                        likes: item.counts?.likes ?? 0,
                        replies: item.counts?.replies ?? 0,
                        quotes: item.counts?.quotes ?? 0,
                      })}
                    </Text>
                  </button>
                ))}
                {items.length === 0 && (
                  <Text size="xs" c="dimmed" p="md">
                    {t('xMarketing.crm.noProspects')}
                  </Text>
                )}
              </section>
            );
          })}
        </div>
        {selected && (
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
              <Score interaction={selected} />
            </Group>
            <Title order={4} mt="lg">
              {t('xMarketing.crm.engagementHistory')}
            </Title>
            <Stack gap={4} mt="xs">
              <Text size="sm">
                {reactionLabel(selected.reactionType, t)}: {selected.postText}
              </Text>
              <Text size="xs" c="dimmed">
                {t('xMarketing.counts', {
                  likes: selected.counts?.likes ?? 0,
                  replies: selected.counts?.replies ?? 0,
                  quotes: selected.counts?.quotes ?? 0,
                })}
              </Text>
            </Stack>
            <Title order={4} mt="lg">
              {t('xMarketing.crm.stage')}
            </Title>
            <Select
              mt="xs"
              data={stages.map((item) => ({ value: item.id, label: item.label }))}
              value={stage}
              allowDeselect={false}
              onChange={(value) => {
                if (value) {
                  setStage(value as XMarketingStage);
                }
              }}
            />
            <Title order={4} mt="lg">
              {t('xMarketing.crm.topics')}
            </Title>
            <TagsInput
              mt="xs"
              data={tagOptions}
              value={tags}
              onChange={setTags}
              maxTags={10}
              placeholder={t('xMarketing.crm.addTag')}
            />
            <Title order={4} mt="lg">
              {t('xMarketing.crm.memo')}
            </Title>
            <Textarea
              mt="xs"
              value={memo}
              onChange={(e) => setMemo(e.currentTarget.value)}
              minRows={4}
              maxLength={500}
              placeholder={t('xMarketing.crm.memoPlaceholder')}
            />
            <Alert mt="md" icon={<IconLock size={16} />} color="palePurple">
              {t('xMarketing.crm.noAutomation')}
            </Alert>
            <Group grow mt="md">
              <Button
                component="a"
                href={`https://x.com/${selected.username}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                leftSection={<IconBrandX size={16} />}
              >
                {t('xMarketing.crm.viewProfile')}
              </Button>
              <Button loading={saving} onClick={save} leftSection={<IconDeviceFloppy size={16} />}>
                {t('xMarketing.crm.recordResponse')}
              </Button>
            </Group>
          </aside>
        )}
      </div>
    </div>
  );
}
