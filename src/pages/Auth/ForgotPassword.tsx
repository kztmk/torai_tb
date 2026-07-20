import { useEffect } from 'react'; // useEffect をインポート
import {
  IconArrowLeft,
  IconCheck, // 通知用アイコン
  IconExclamationCircle, // 通知用アイコン
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Center,
  Container,
  Group,
  LoadingOverlay, // ローディング表示
  Paper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { isEmail, isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications'; // 通知機能
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks'; // Reduxフック
import {
  resetTask,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
} from '@/store/reducers/auth';
// Redux state と action
import { sendPasswordResetEmail } from '@/store/reducers/auth/authThunks'; // 新規作成するThunk
import classes from './ForgotPassword.module.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();

  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const task = useAppSelector(selectAuthTask);

  const form = useForm({
    initialValues: {
      email: '',
    },
    validate: {
      email: (value) => {
        if (!value) {
          return t('auth.validation.emailRequired');
        }
        return (
          isNotEmpty(t('auth.validation.emailRequired'))(value) ||
          isEmail(t('auth.validation.validEmail'))(value)
        );
      },
    },
  });

  const handleSubmit = async (values: { email: string }) => {
    console.log('Reset password for:', values.email);
    dispatch(resetTask()); // 既存のタスク状態をクリア
    try {
      // Cloud Function を呼び出す Thunk を dispatch
      // lang パラメータで言語を指定 (例: 'ja' または 'en')
      // ここでは 'ja' を指定していますが、アプリの言語設定に応じて動的に変更可能です。
      await dispatch(
        sendPasswordResetEmail({ email: values.email, lang: i18n.resolvedLanguage || 'ja' })
      ).unwrap();
      // 成功時の通知と画面遷移は useEffect で行う
    } catch (error: any) {
      // unwrap() がエラーをスローするのでここでキャッチ
      // エラー通知は useEffect で authError を監視して行う
      console.error('Failed to send password reset email:', error);
    }
  };

  // task と authError の変更を監視して通知とナビゲーションを行う
  useEffect(() => {
    if (task === 'password_reset_request') {
      notifications.show({
        id: 'password-reset-flow',
        loading: true,
        title: t('auth.processing'),
        message: t('auth.sendingResetEmail'),
        autoClose: false,
        withCloseButton: false,
      });
    } else if (task === 'password_reset_success') {
      notifications.update({
        id: 'password-reset-flow',
        color: 'green',
        title: t('auth.sent'),
        message: t('auth.resetEmailSent'),
        icon: <IconCheck size={16} />,
        autoClose: 7000,
        withCloseButton: true,
      });
      navigate('/auth/reset-password', { replace: true }); // 成功ページへ遷移
    } else if (task === 'password_reset_error' && authError) {
      notifications.update({
        id: 'password-reset-flow',
        color: 'red',
        title: t('auth.sendError'),
        message: authError, // Reduxストアからのエラーメッセージ
        icon: <IconExclamationCircle size={16} />,
        autoClose: 7000,
        withCloseButton: true,
      });
    }
  }, [task, authError, navigate, dispatch, t]);

  return (
    <Container size={460} my={30}>
      <Title className={classes.title} ta="center">
        {t('auth.forgotPasswordTitle')}
      </Title>
      <Text c="dimmed" fz="sm" ta="center">
        {t('auth.forgotPasswordDescription')}
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md" mt="xl" style={{ position: 'relative' }}>
        <LoadingOverlay
          visible={isLoading && task === 'password_reset_request'}
          zIndex={1000}
          overlayProps={{ radius: 'sm', blur: 2 }}
        />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label={t('auth.registeredEmail')}
            placeholder="rest@imakita3gyo.com"
            {...form.getInputProps('email')}
            error={form.errors.email}
          />
          <Group justify="space-between" mt="lg" className={classes.controls}>
            <Text
              size="sm"
              className={`${classes.control} ${classes.linkText}`}
              onClick={() => navigate('/auth/signin')}
            >
              <Center inline>
                <IconArrowLeft size={12} stroke={1.5} />
                <Box ml={5}>{t('auth.backToSignIn')}</Box>
              </Center>
            </Text>
            <Button
              type="submit"
              className={classes.control}
              disabled={isLoading && task === 'password_reset_request'} // ローディング中は無効化
            >
              {t('auth.resetPassword')}
            </Button>
          </Group>
        </form>
      </Paper>
    </Container>
  );
}
