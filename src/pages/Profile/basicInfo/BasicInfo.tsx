import { useEffect, useRef, useState } from 'react';
import { IconAlertCircle, IconCopy, IconKey, IconUpload, IconX } from '@tabler/icons-react';
import { getApp } from 'firebase/app';
import { User as FirebaseAuthUser } from 'firebase/auth'; // Firebase Auth の User 型をインポート
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { FileWithPath } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import AvatarDropzone from '@/components/DropZone/AvatarDropzone';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { setProfile } from '@/store/reducers/auth';
import { sendVerificationEmailThunk } from '@/store/reducers/auth/authThunks'; // Thunkをインポート

import SystemAnnouncementTable from '../systemAnnouncements/sysAnnouncementsTable/sysAnnouncementsTable';

interface BasicInfoProps {
  authUser: FirebaseAuthUser; // ProfilePage から渡される Firebase Auth の User オブジェクト
}

type IssueFreeToolUnlockKeyResponse = {
  unlockKey: string;
  issuedAt: string;
};

function BasicInfo({ authUser }: BasicInfoProps) {
  const { t, i18n } = useTranslation();
  const [avatarFile, setAvatarFile] = useState<FileWithPath | null>(null);
  const [openSysAnnouncement, setSysAnnouncement] = useState(false);
  const [freeToolUnlockKey, setFreeToolUnlockKey] = useState('');
  const [hasIssuedFreeToolUnlockKey, setHasIssuedFreeToolUnlockKey] = useState(false);
  const [isIssuingFreeToolUnlockKey, setIsIssuingFreeToolUnlockKey] = useState(false);
  const isMountedRef = useRef(true);
  const {
    loading,
    user: reduxUser,
    error,
    task, // メール送信中の状態をストアから取得
  } = useAppSelector((state) => state.auth);
  const isSendingVerificationEmail = reduxUser.isSendingEmailVerification;

  // メールアドレスは Firebase Auth の情報を正とする
  const currentEmail = authUser.email;
  const isEmailVerified = authUser.emailVerified;
  console.log(`isEmailVerified: ${isEmailVerified}`);

  // フォームの初期値や表示用のアバターURLを設定
  // Reduxのユーザー情報（Firestoreと同期されている想定）を優先し、なければpropの情報をフォールバックとして使用
  const initialDisplayName = reduxUser?.displayName || authUser.displayName || '';
  const initialRole = reduxUser?.role || '';
  const displayAvatarUrl = reduxUser?.avatarUrl || authUser.photoURL;

  const form = useForm({
    initialValues: {
      displayName: initialDisplayName,
      role: initialRole,
    },
  });

  const dispatch = useAppDispatch();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (error) {
      if (task === 'error_profile') {
        notifications.show({
          title: t('common.error'),
          message: t('profile.basic.updateFailed'),
          color: 'red',
          icon: <IconX size="1rem" />,
        });
      }
    }
    if (task === 'update_profile') {
      notifications.show({
        title: t('profile.basic.updated'),
        message: t('profile.basic.updatedMessage'),
        color: 'green',
        icon: <IconUpload size="1rem" />,
      });
    }
  }, [error, t, task]);

  useEffect(() => {
    let active = true;

    const loadFreeToolUnlockKeyStatus = async () => {
      try {
        const firestore = getFirestore(getApp());
        const keyUserSnap = await getDoc(
          doc(firestore, 'freeToolUnlockKeyUsers', authUser.uid)
        );
        if (active) {
          setHasIssuedFreeToolUnlockKey(keyUserSnap.exists());
        }
      } catch {
        if (active) {
          setHasIssuedFreeToolUnlockKey(false);
        }
      }
    };

    loadFreeToolUnlockKeyStatus();

    return () => {
      active = false;
    };
  }, [authUser.uid]);

  // プロフィール情報（表示名、役割、アバター）の保存
  const onSubmit = async (values: { displayName: string; role: string }) => {
    dispatch(
      setProfile({
        displayName: values.displayName,
        role: values.role,
        avatar: avatarFile,
        backgroundImage: null,
      })
    );
  };

  const handleCloseSysAnnouncement = () => {
    setSysAnnouncement(false);
  };

  const handleSendVerificationEmail = async () => {
    const currentUserLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'ja';

    try {
      const resultAction = await dispatch(
        sendVerificationEmailThunk({ lang: currentUserLanguage })
      );
      if (sendVerificationEmailThunk.fulfilled.match(resultAction)) {
        notifications.show({
          title: t('profile.basic.verificationSent'),
          message:
            resultAction.payload.message || t('profile.basic.verificationSentMessage'),
          color: 'blue',
        });
      } else if (sendVerificationEmailThunk.rejected.match(resultAction)) {
        notifications.show({
          title: t('common.error'),
          message: resultAction.payload?.message || t('profile.basic.verificationFailed'),
          color: 'red',
        });
      }
    } catch (err) {
      // Thunkの呼び出し自体で予期せぬエラーが発生した場合
      notifications.show({
        title: t('common.error'),
        message: t('profile.basic.verificationUnexpected'),
        color: 'red',
      });
      console.error('Unexpected error during sendVerificationEmailThunk dispatch:', err);
    }
  };

  const handleIssueFreeToolUnlockKey = () => {
    modals.openConfirmModal({
      title: t('profile.basic.unlock.issueTitle'),
      centered: true,
      children: (
        <Text size="sm">
          {hasIssuedFreeToolUnlockKey
            ? t('profile.basic.unlock.reissueConfirm')
            : t('profile.basic.unlock.issueConfirm')}
        </Text>
      ),
      labels: { confirm: t('profile.basic.unlock.issue'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!isMountedRef.current) {
          return;
        }
        setIsIssuingFreeToolUnlockKey(true);
        try {
          const functions = getFunctions(getApp(), 'asia-northeast1');
          const issueFreeToolUnlockKey = httpsCallable<unknown, IssueFreeToolUnlockKeyResponse>(
            functions,
            'issueFreeToolUnlockKey'
          );
          const result = await issueFreeToolUnlockKey({});
          if (isMountedRef.current) {
            setFreeToolUnlockKey(result.data.unlockKey);
            setHasIssuedFreeToolUnlockKey(true);
          }
          notifications.show({
            title: t('profile.basic.unlock.issued'),
            message: t('profile.basic.unlock.issuedMessage', { key: result.data.unlockKey }),
            color: 'green',
            icon: <IconKey size="1rem" />,
            autoClose: false,
          });
        } catch (issueError: any) {
          if (isMountedRef.current) {
            notifications.show({
              title: t('profile.basic.unlock.issueFailed'),
              message: issueError?.message || t('xMarketing.errors.tryAgain'),
              color: 'red',
              icon: <IconX size="1rem" />,
            });
          }
        } finally {
          if (isMountedRef.current) {
            setIsIssuingFreeToolUnlockKey(false);
          }
        }
      },
    });
  };

  const handleCopyFreeToolUnlockKey = async () => {
    if (!freeToolUnlockKey) {
      return;
    }
    if (!navigator.clipboard) {
      notifications.show({
        title: t('profile.basic.unlock.copyFailed'),
        message: t('profile.basic.unlock.clipboardUnsupported'),
        color: 'orange',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(freeToolUnlockKey);
      notifications.show({
        title: t('profile.basic.unlock.copied'),
        message: t('profile.basic.unlock.copiedMessage'),
        color: 'blue',
        icon: <IconCopy size="1rem" />,
      });
    } catch {
      notifications.show({
        title: t('profile.basic.unlock.copyFailed'),
        message: t('profile.basic.unlock.copyManually'),
        color: 'orange',
      });
    }
  };

  return (
    <>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />
        <Stack>
          <Title order={4}>{t('profile.basic.title')}</Title>

          <Paper p="md" withBorder mt="md">
            <Stack>
              <Title order={5}>{t('auth.email')}</Title>
              <TextInput
                label={t('profile.basic.currentEmail')}
                value={currentEmail || ''}
                readOnly
                variant="filled"
                styles={{
                  input: {
                    cursor: 'default',
                  },
                }}
              />
              {!isEmailVerified && currentEmail && (
                <Alert
                  icon={<IconAlertCircle size="1rem" />}
                  title={t('profile.basic.emailUnverified')}
                  color="orange"
                  variant="light"
                >
                  <Text size="sm">
                    {t('profile.basic.emailUnverifiedMessage')}
                  </Text>
                  <Button
                    variant="outline"
                    color="orange"
                    size="xs"
                    mt="xs"
                    loading={isSendingVerificationEmail} // ローディング状態を適用
                    onClick={handleSendVerificationEmail}
                  >
                    {t('profile.basic.resendVerification')}
                  </Button>
                </Alert>
              )}
            </Stack>
          </Paper>

          <Paper p="md" withBorder mt="md">
            <Stack>
              <Title order={5}>{t('profile.basic.unlock.title')}</Title>
              <Text size="sm" c="dimmed">
                {t('profile.basic.unlock.description')}
                <br />
                <Text component="span" c="red" fw={700}>
                  {t('profile.basic.unlock.onceNotice')}
                </Text>
              </Text>
              {hasIssuedFreeToolUnlockKey && !freeToolUnlockKey && (
                <Alert color="yellow" variant="light">
                  {t('profile.basic.unlock.alreadyIssued')}
                </Alert>
              )}
              <Group align="flex-end" wrap="wrap">
                <TextInput
                  label={t('profile.basic.unlock.key')}
                  value={freeToolUnlockKey}
                  readOnly
                  placeholder={
                    hasIssuedFreeToolUnlockKey
                      ? t('profile.basic.unlock.issuedPlaceholder')
                      : t('profile.basic.unlock.notIssuedPlaceholder')
                  }
                  style={{ flex: '1 1 280px' }}
                />
                <Button
                  type="button"
                  leftSection={<IconKey size="1rem" />}
                  loading={isIssuingFreeToolUnlockKey}
                  onClick={handleIssueFreeToolUnlockKey}
                >
                  {hasIssuedFreeToolUnlockKey
                    ? t('profile.basic.unlock.reissue')
                    : t('profile.basic.unlock.issue')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  leftSection={<IconCopy size="1rem" />}
                  disabled={!freeToolUnlockKey}
                  onClick={handleCopyFreeToolUnlockKey}
                >
                  {t('profile.basic.unlock.copy')}
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Center>
            <Stack align="center">
              <form onSubmit={form.onSubmit(onSubmit)}>
                <Stack align="center">
                  <Title order={5} mt="md">
                    {t('profile.basic.avatar')}
                  </Title>
                  <AvatarDropzone
                    onFilesSelected={(files: File[]) => setAvatarFile(files[0])}
                    {...(displayAvatarUrl ? { defaultUrl: displayAvatarUrl } : {})}
                  />
                </Stack>
                <Group mt="xs">
                  <Box style={{ textAlign: 'left' }}>
                    <TextInput
                      label={t('profile.basic.role')}
                      placeholder={t('profile.basic.role')}
                      withAsterisk
                      {...form.getInputProps('role')}
                      key={form.key('role')}
                      mb="md"
                      w="100%"
                    />
                  </Box>
                  <Box style={{ textAlign: 'left' }}>
                    <TextInput
                      label={t('auth.displayName')}
                      placeholder={t('auth.displayName')}
                      withAsterisk
                      {...form.getInputProps('displayName')}
                      key={form.key('displayName')}
                      mb="md"
                      w="100%"
                    />
                  </Box>
                </Group>
                {/* System Announcements Button - added as per image, though functionality isn't specified */}
                <Button type="submit" mt="sm">
                  {t('common.save')}
                </Button>
                {/* role のチェックには Redux から取得した initialRole を使用 */}
                {initialRole === 'admin1114inazuma' && (
                  <Button
                    variant="outline"
                    color="blue"
                    mt="sm"
                    onClick={() => setSysAnnouncement(true)}
                  >
                    {t('profile.basic.systemAnnouncements')}
                  </Button>
                )}
              </form>
            </Stack>
          </Center>
        </Stack>
      </Paper>
      <Modal
        opened={openSysAnnouncement}
        onClose={handleCloseSysAnnouncement}
        title="System Announcements"
      >
        <SystemAnnouncementTable />
      </Modal>
    </>
  );
}

export default BasicInfo;
