import React, { useEffect, useState } from 'react';
import { IconCheck, IconExclamationCircle } from '@tabler/icons-react';
import { applyActionCode } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Container, LoadingOverlay, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { auth, db } from '@/firebase'; // Firebase auth インスタンス

const EmailActionHandler: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const actionCode = searchParams.get('oobCode');
    // const lang = searchParams.get('lang'); // 必要に応じて言語情報を利用

    if (!actionCode) {
      setError(t('auth.verify.invalidRequest'));
      setLoading(false);
      return;
    }

    if (mode === 'verifyEmail') {
      setLoading(true);
      setError(null);
      setMessage(t('auth.verify.checking'));

      applyActionCode(auth, actionCode)
        .then(async () => {
          const currentUser = auth.currentUser;
          if (currentUser) {
            try {
              await currentUser.reload();
              await currentUser.getIdToken(true);
              await setDoc(
                doc(db, 'users', currentUser.uid),
                {
                  emailVerified: true,
                  emailVerifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (fsError) {
              console.error('Failed to sync email verification to Firestore:', fsError);
            }
          }

          setMessage(t('auth.verify.success'));
          setSuccess(true);
          notifications.show({
            title: t('auth.verify.complete'),
            message: t('auth.verify.completeMessage'),
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        })
        .catch((err) => {
          console.error('Error verifying email:', err);
          let userMessage = t('auth.verify.failed');
          if (err.code === 'auth/invalid-action-code') {
            userMessage = t('auth.verify.invalidCode');
          } else if (err.code === 'auth/user-disabled') {
            userMessage = t('auth.verify.userDisabled');
          } else if (err.code === 'auth/user-not-found') {
            userMessage = t('auth.verify.userNotFound');
          }
          setError(userMessage);
          notifications.show({
            title: t('auth.verify.error'),
            message: userMessage,
            color: 'red',
            icon: <IconExclamationCircle size={16} />,
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setError(t('auth.verify.unsupportedMode', { mode }));
      setLoading(false);
    }
  }, [searchParams, navigate, t]);

  return (
    <Container size="xs" py="xl">
      <Paper shadow="md" p="xl" radius="md" withBorder style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />
        <Stack align="center">
          <Title order={2} ta="center" mb="lg">
            {t('auth.verify.title')}
          </Title>
          {message && !error && (
            <Text c={success ? 'green.7' : 'blue.7'} ta="center">
              {message}
            </Text>
          )}
          {error && (
            <Text c="red.7" ta="center">
              {error}
            </Text>
          )}
          {!loading && (
            <Button component={RouterLink} to="/auth/signin" mt="lg" fullWidth>
              {t('auth.backToSignIn')}
            </Button>
          )}
        </Stack>
      </Paper>
    </Container>
  );
};

export default EmailActionHandler;
