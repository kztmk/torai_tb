// src/pages/Profile/subscriptionManagement/MokumokurenCouponCard.tsx
import { useEffect, useState } from 'react';
import { IconGift } from '@tabler/icons-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Anchor, Button, CopyButton, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { db } from '@/firebase';
import { useAppSelector } from '@/hooks/rtkhooks';
import { useTranslation } from 'react-i18next';

const MOKUMOKUREN_SITE_URL = 'https://docs-mokumokuren.imakita3gyo.com/';

// サブスク特典: mokumokuren Pro 2ヶ月無料クーポンの表示カード。
// コードは契約完了時に Functions（issueMokumokurenCoupon）が発行して
// users/{uid}.mokumokurenCoupon に保存する。未発行の間は何も表示しない。
export default function MokumokurenCouponCard() {
  const { t } = useTranslation();
  const uid = useAppSelector((state) => state.auth.user?.uid);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setCode(null);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setCode(snap.data()?.mokumokurenCoupon?.code ?? null);
      },
      (error) => {
        // 権限エラーや一時的な切断など。特典表示は本質機能ではないので隠して静かに記録する。
        console.error('Error listening to user document for mokumokuren coupon:', error);
        setCode(null);
      }
    );
  }, [uid]);

  if (code === null || code === '') {
    return null;
  }

  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Stack gap="xs">
        <Group gap="xs">
          <IconGift size="1.2rem" />
          <Title order={4}>{t('subscription.coupon.title')}</Title>
        </Group>
        <Text size="sm">
          {t('subscription.coupon.prefix')}
          <Anchor href={MOKUMOKUREN_SITE_URL} target="_blank" rel="noopener noreferrer">
            mokumokuren
          </Anchor>
          {t('subscription.coupon.suffix')}
        </Text>
        <Group gap="sm">
          <Text ff="monospace" fw={700} fz="lg" data-testid="mokumokuren-coupon-code">
            {code}
          </Text>
          <CopyButton value={code}>
            {({ copied, copy }) => (
              <Button size="xs" variant={copied ? 'filled' : 'light'} onClick={copy}>
                {copied ? t('subscription.coupon.copied') : t('subscription.coupon.copy')}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Text size="xs" c="dimmed">
          {t('subscription.coupon.instructions')}
        </Text>
      </Stack>
    </Paper>
  );
}
