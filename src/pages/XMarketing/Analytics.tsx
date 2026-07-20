import { useId, useMemo } from 'react';
import { IconActivity, IconBrandX, IconChartBar, IconEye, IconFileText } from '@tabler/icons-react';
import { Alert, Badge, Group, Paper, ScrollArea, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/rtkhooks';
import { selectXMarketing } from '@/store/reducers/xMarketingSlice';
import type { XMarketingDailyMetric, XMarketingDashboard } from '@/types/xMarketing';
import { MarketingHeader } from './shared';
import classes from './XMarketing.module.css';

export default function Analytics({ dashboard }: { dashboard: XMarketingDashboard }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const { selectedAccountId } = useAppSelector(selectXMarketing);
  const posts = useMemo(
    () =>
      (dashboard.analytics?.posts || [])
        .filter((post) => selectedAccountId === 'all' || post.accountId === selectedAccountId)
        .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)),
    [dashboard.analytics?.posts, selectedAccountId]
  );
  const daily = useMemo(
    () => aggregateDaily(dashboard.analytics?.daily || [], selectedAccountId),
    [dashboard.analytics?.daily, selectedAccountId]
  );
  const totals = posts.reduce(
    (result, post) => ({
      impressions: result.impressions + post.metrics.impressions,
      impressionsAvailable: result.impressionsAvailable && post.availability.impressions,
      engagements: result.engagements + post.metrics.engagements,
      reactions:
        result.reactions +
        post.metrics.likes +
        post.metrics.replies +
        post.metrics.reposts +
        post.metrics.quotes,
    }),
    { impressions: 0, impressionsAvailable: true, engagements: 0, reactions: 0 }
  );
  const engagementRate =
    totals.impressionsAvailable && totals.impressions > 0
      ? (totals.engagements / totals.impressions) * 100
      : null;
  const impressionChange = changeRate(
    daily.length > 1 && daily[daily.length - 2].impressionsAvailable
      ? daily[daily.length - 2].impressions
      : null,
    daily.length > 0 && daily[daily.length - 1].impressionsAvailable
      ? daily[daily.length - 1].impressions
      : null
  );

  return (
    <div className={classes.page}>
      <MarketingHeader
        title={t('xMarketing.analytics.title')}
        description={t('xMarketing.analytics.description', {
          count: dashboard.settings.trackingDays,
        })}
        dashboard={dashboard}
        accountId={selectedAccountId}
        statusBadges={
          <>
            <Badge color={dashboard.settings.enabled ? 'green' : 'gray'} variant="light">
              {t('xMarketing.analytics.responderCollection')}{' '}
              {dashboard.settings.enabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge color={dashboard.settings.analyticsEnabled ? 'green' : 'gray'} variant="light">
              {t('xMarketing.analytics.title')} {dashboard.settings.analyticsEnabled ? 'ON' : 'OFF'}
            </Badge>
          </>
        }
      />

      {!dashboard.settings.analyticsEnabled && posts.length > 0 && (
        <Alert color="yellow" title={t('xMarketing.analytics.paused')} mb="md">
          {t('xMarketing.analytics.pausedMessage')}
        </Alert>
      )}

      <section className={classes.summary}>
        {[
          {
            label: t('xMarketing.analytics.trackedPosts'),
            value: numberFormatter.format(posts.length),
            icon: <IconFileText />,
          },
          {
            label: t('xMarketing.analytics.impressions'),
            value: totals.impressionsAvailable ? numberFormatter.format(totals.impressions) : '—',
            icon: <IconEye />,
          },
          {
            label: t('xMarketing.analytics.engagements'),
            value: numberFormatter.format(totals.engagements),
            icon: <IconActivity />,
          },
          {
            label: t('xMarketing.analytics.engagementRate'),
            value: formatRate(engagementRate),
            icon: <IconChartBar />,
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

      {posts.length === 0 ? (
        <Alert
          title={
            dashboard.settings.analyticsEnabled
              ? t('xMarketing.analytics.noData')
              : t('xMarketing.analytics.disabled')
          }
        >
          {dashboard.settings.analyticsEnabled
            ? t('xMarketing.waitForRefresh')
            : t('xMarketing.analytics.enableFromSettings')}
        </Alert>
      ) : (
        <>
          <Paper withBorder radius="md" p="md" mb="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Title order={4}>{t('xMarketing.analytics.dailyTrend')}</Title>
                <Text size="xs" c="dimmed">
                  {t('xMarketing.analytics.dailyTrendDescription')}
                </Text>
              </div>
              {impressionChange !== null && (
                <Badge color={impressionChange >= 0 ? 'green' : 'red'} variant="light">
                  {t('xMarketing.analytics.impressionsDayOverDay')}{' '}
                  {impressionChange >= 0 ? '+' : ''}
                  {impressionChange.toFixed(1)}%
                </Badge>
              )}
            </Group>
            {daily.length > 0 ? (
              <>
                <DailyTrendChart metrics={daily} />
                <Text size="xs" c="dimmed" fw={600} mb={6}>
                  {t('xMarketing.analytics.dailyValues')}
                </Text>
                <ScrollArea>
                  <Table striped highlightOnHover miw={680}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('xMarketing.analytics.date')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.analytics.posts')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.analytics.impressions')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.analytics.engagements')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.analytics.rate')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.reactions.like')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.analytics.replies')}</Table.Th>
                        <Table.Th ta="right">{t('xMarketing.reactions.repost')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {daily.map((metric) => (
                        <Table.Tr key={metric.date}>
                          <Table.Td>{formatDate(metric.date, locale)}</Table.Td>
                          <Table.Td ta="right">{numberFormatter.format(metric.postCount)}</Table.Td>
                          <Table.Td ta="right">
                            {metric.impressionsAvailable
                              ? numberFormatter.format(metric.impressions)
                              : '—'}
                          </Table.Td>
                          <Table.Td ta="right">
                            {numberFormatter.format(metric.engagements)}
                          </Table.Td>
                          <Table.Td ta="right">{formatRate(metric.engagementRate)}</Table.Td>
                          <Table.Td ta="right">{numberFormatter.format(metric.likes)}</Table.Td>
                          <Table.Td ta="right">{numberFormatter.format(metric.replies)}</Table.Td>
                          <Table.Td ta="right">{numberFormatter.format(metric.reposts)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                {t('xMarketing.analytics.dailyAfterNextSync')}
              </Text>
            )}
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Title order={4}>{t('xMarketing.analytics.latestByPost')}</Title>
                <Text size="xs" c="dimmed">
                  {t('xMarketing.analytics.permissionNotice')}
                </Text>
              </div>
              <Text size="xs" c="dimmed">
                {t('xMarketing.analytics.totalReactions')}{' '}
                {numberFormatter.format(totals.reactions)}
              </Text>
            </Group>
            <ScrollArea>
              <Table highlightOnHover miw={980}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('xMarketing.analytics.post')}</Table.Th>
                    <Table.Th>{t('xMarketing.analytics.postedAt')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.impressions')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.rate')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.reactions.like')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.replies')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.reactions.repost')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.quotes')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.bookmarks')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.profileClicks')}</Table.Th>
                    <Table.Th ta="right">{t('xMarketing.analytics.urlClicks')}</Table.Th>
                    <Table.Th>X</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {posts.map((post) => (
                    <Table.Tr key={post.id}>
                      <Table.Td maw={360}>
                        <Text size="sm" lineClamp={2}>
                          {post.text || t('xMarketing.analytics.textUnavailable')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          @{post.accountId}
                        </Text>
                      </Table.Td>
                      <Table.Td>{formatDate(post.createdAt, locale)}</Table.Td>
                      <Table.Td ta="right">
                        {post.availability.impressions
                          ? numberFormatter.format(post.metrics.impressions)
                          : '—'}
                      </Table.Td>
                      <Table.Td ta="right">{formatRate(post.engagementRate)}</Table.Td>
                      <Table.Td ta="right">{numberFormatter.format(post.metrics.likes)}</Table.Td>
                      <Table.Td ta="right">{numberFormatter.format(post.metrics.replies)}</Table.Td>
                      <Table.Td ta="right">{numberFormatter.format(post.metrics.reposts)}</Table.Td>
                      <Table.Td ta="right">{numberFormatter.format(post.metrics.quotes)}</Table.Td>
                      <Table.Td ta="right">
                        {numberFormatter.format(post.metrics.bookmarks)}
                      </Table.Td>
                      <Table.Td ta="right">
                        {post.availability.profileClicks
                          ? numberFormatter.format(post.metrics.profileClicks)
                          : '—'}
                      </Table.Td>
                      <Table.Td ta="right">
                        {post.availability.urlClicks
                          ? numberFormatter.format(post.metrics.urlClicks)
                          : '—'}
                      </Table.Td>
                      <Table.Td>
                        <a
                          href={`https://x.com/${post.accountId}/status/${post.postId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('xMarketing.analytics.openOnX')}
                        >
                          <IconBrandX size={17} />
                        </a>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </>
      )}
    </div>
  );
}

function DailyTrendChart({ metrics }: { metrics: XMarketingDailyMetric[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const titleId = useId();
  const width = Math.max(760, metrics.length * 64);
  const height = 260;
  const margin = { top: 18, right: 58, bottom: 42, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const impressionMax = Math.max(
    1,
    ...metrics.filter((metric) => metric.impressionsAvailable).map((metric) => metric.impressions)
  );
  const engagementMax = Math.max(1, ...metrics.map((metric) => metric.engagements));
  const x = (index: number) =>
    metrics.length === 1
      ? margin.left + plotWidth / 2
      : margin.left + (plotWidth * index) / (metrics.length - 1);
  const impressionY = (value: number) =>
    margin.top + plotHeight - (plotHeight * value) / impressionMax;
  const engagementY = (value: number) =>
    margin.top + plotHeight - (plotHeight * value) / engagementMax;
  const impressionPath = metrics.reduce(
    (path, metric, index) => {
      if (!metric.impressionsAvailable) {
        return { value: path.value, connected: false };
      }
      return {
        value: `${path.value}${path.connected ? ' L' : ' M'} ${x(index)} ${impressionY(metric.impressions)}`,
        connected: true,
      };
    },
    { value: '', connected: false }
  ).value;
  const barWidth = Math.min(30, Math.max(12, plotWidth / metrics.length / 2.6));
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={classes.trendChart}>
      <Group gap="lg" justify="center" mb={4}>
        <Group gap={6}>
          <span className={classes.impressionLegend} />
          <Text size="xs">{t('xMarketing.analytics.impressions')}</Text>
        </Group>
        <Group gap={6}>
          <span className={classes.engagementLegend} />
          <Text size="xs">{t('xMarketing.analytics.engagements')}</Text>
        </Group>
      </Group>
      <ScrollArea type="auto" offsetScrollbars>
        <svg
          aria-labelledby={titleId}
          className={classes.trendChartSvg}
          height={height}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
        >
          <title id={titleId}>{t('xMarketing.analytics.chartTitle')}</title>
          {ticks.map((ratio) => {
            const tickY = margin.top + plotHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  className={classes.chartGridLine}
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={tickY}
                  y2={tickY}
                />
                <text
                  className={classes.chartAxisLabel}
                  x={margin.left - 10}
                  y={tickY + 4}
                  textAnchor="end"
                >
                  {formatCompactNumber(impressionMax * ratio, locale)}
                </text>
                <text
                  className={classes.chartAxisLabel}
                  x={width - margin.right + 10}
                  y={tickY + 4}
                >
                  {formatCompactNumber(engagementMax * ratio, locale)}
                </text>
              </g>
            );
          })}
          {metrics.map((metric, index) => {
            const barTop = engagementY(metric.engagements);
            return (
              <g key={metric.date}>
                <rect
                  className={classes.engagementBar}
                  height={margin.top + plotHeight - barTop}
                  rx={3}
                  width={barWidth}
                  x={x(index) - barWidth / 2}
                  y={barTop}
                >
                  <title>
                    {formatDate(metric.date, locale)} {t('xMarketing.analytics.engagements')}{' '}
                    {numberFormatter.format(metric.engagements)}
                  </title>
                </rect>
                <text
                  className={classes.chartAxisLabel}
                  textAnchor="middle"
                  x={x(index)}
                  y={height - 14}
                >
                  {formatDate(metric.date, locale)}
                </text>
              </g>
            );
          })}
          {impressionPath !== '' && <path className={classes.impressionLine} d={impressionPath} />}
          {metrics.map(
            (metric, index) =>
              metric.impressionsAvailable && (
                <circle
                  className={classes.impressionPoint}
                  cx={x(index)}
                  cy={impressionY(metric.impressions)}
                  key={metric.date}
                  r={4}
                >
                  <title>
                    {formatDate(metric.date, locale)} {t('xMarketing.analytics.impressions')}{' '}
                    {numberFormatter.format(metric.impressions)}
                  </title>
                </circle>
              )
          )}
        </svg>
      </ScrollArea>
    </div>
  );
}

function formatCompactNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

function aggregateDaily(metrics: XMarketingDailyMetric[], accountId: string) {
  const grouped = new Map<string, XMarketingDailyMetric>();
  metrics
    .filter((metric) => accountId === 'all' || metric.accountId === accountId)
    .forEach((metric) => {
      const current = grouped.get(metric.date) || {
        accountId: accountId === 'all' ? 'all' : metric.accountId,
        date: metric.date,
        postCount: 0,
        impressions: 0,
        engagements: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        engagementRate: null,
        impressionsAvailable: true,
      };
      current.postCount += metric.postCount;
      current.impressions += metric.impressions;
      current.engagements += metric.engagements;
      current.likes += metric.likes;
      current.replies += metric.replies;
      current.reposts += metric.reposts;
      current.quotes += metric.quotes;
      current.impressionsAvailable = current.impressionsAvailable && metric.impressionsAvailable;
      current.engagementRate =
        current.impressionsAvailable && current.impressions > 0
          ? (current.engagements / current.impressions) * 100
          : null;
      grouped.set(metric.date, current);
    });
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function timestamp(value: string) {
  const result = new Date(value).getTime();
  return Number.isNaN(result) ? 0 : result;
}

function formatDate(value: string, locale: string) {
  const dateOnly = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}/${dateOnly[2]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' });
}

function formatRate(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
}

function changeRate(previous: number | null, current: number | null) {
  if (previous === null || current === null || previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}
