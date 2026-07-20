import { Fragment, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Alert, Avatar, Badge, Box, Card, Center, Grid, Loader, Stack, Text } from '@mantine/core';
// project-imports
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { fetchXTrends, selectXTrends } from '@/store/reducers/xTrendSlice';
import { useTranslation } from 'react-i18next';

// ==============================|| X trends ||============================== //

const XTrendsTable = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const dispatch = useAppDispatch();

  const { trends, status, error, fetchedAt } = useAppSelector(selectXTrends);

  useEffect(() => {
    const now = Date.now();
    const fetchedTime = fetchedAt ? new Date(fetchedAt).getTime() : 0;
    const fourHours = 4 * 60 * 60 * 1000;
    if (!fetchedAt || now - fetchedTime > fourHours) {
      dispatch(fetchXTrends());
    }
  }, [dispatch, fetchedAt]);

  // ISO文字列をローカルタイム文字列に変換する関数
  const formatToLocalTime = (isoString: string | null): string => {
    if (!isoString) {
      return 'N/A';
    }
    try {
      const date = new Date(isoString);
      // toLocaleString() はブラウザのデフォルトロケールとタイムゾーンを使用
      // return date.toLocaleString();
      // または、特定のフォーマットを指定する場合:
      return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid Date';
    }
  };

  if (error && error.length > 0) {
    return (
      <Grid>
        <Grid.Col span={12}>
          <Text size="xl" fw={700} c="red">
            {t('activity.trends.loadFailed', { error })}
          </Text>
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <Grid mt="lg" gutter="md">
      {status === 'loading' && (
        <Center style={{ width: '100%', height: '100%' }}>
          <Loader size="xl" color="blue" />
        </Center>
      )}
      {status === 'succeeded' && trends.length === 0 && (
        <Grid.Col span={12}>
          <Alert color="blue" variant="light">
            {t('activity.trends.none')}
          </Alert>
        </Grid.Col>
      )}
      {trends &&
        trends.map((xTrend, index) => (
          <Grid.Col span={{ base: 12, md: 6, lg: 4 }} key={index}>
            <Card
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                },
              }}
            >
              <Stack gap="xs" align="center">
                <Text size="lg" fw={700}>
                  {t('activity.trends.title')}
                </Text>
                <Text size="sm" c="dimmed">
                  {formatToLocalTime(xTrend.timestamp)}
                </Text>
              </Stack>
              <Box mt="lg">
                {xTrend.xtrends.map((trend) => (
                  <Fragment key={uuidv4()}>
                    <Card.Section
                      style={{
                        borderBottom: '1px solid #e9ecef',
                        padding: '10px 0',
                      }}
                    >
                      <Grid align="center">
                        <Grid.Col span={2}>
                          <Avatar radius="md" size="md" color="blue" variant="filled">
                            {trend.rank}
                          </Avatar>
                        </Grid.Col>
                        <Grid.Col span={8}>
                          <Text size="sm" fw={500}>
                            {trend.keyword}
                          </Text>
                          <Text size="xs" color="dimmed">
                            {trend.chart}
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={2}>
                          {trend.posts && trend.posts > 0 && (
                            <Badge color="green" size="sm" variant="filled">
                              {trend.posts}
                            </Badge>
                          )}
                        </Grid.Col>
                      </Grid>
                    </Card.Section>
                  </Fragment>
                ))}
              </Box>
            </Card>
          </Grid.Col>
        ))}
    </Grid>
  );
};

export default XTrendsTable;
