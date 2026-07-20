import { useEffect, useState } from 'react';
import { IconExclamationCircle, IconMail } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Container, LoadingOverlay, Paper, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import signinImage from '@/assets/images/signin01-1.jpg';
import { APP_DEFAULT_PATH } from '@/config';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  resetTask,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
  selectTermsAccepted,
  selectUser,
  signInWithGoogle,
} from '@/store/reducers/auth';
import classes from './SignInImage.module.css';

const PENDING_REFERRAL_CODE_STORAGE_KEY = 'torai_pending_referral_code';

// コンポーネント定義でプロパティを受け取る
export default function SignIn() {
  // _appMode が提供されていればそれを使用し、なければ環境変数から取得
  const appMode = import.meta.env.VITE_APP_MODE;
  const isPreview = appMode === 'preview';
  // console.log は残しておいても良い
  console.log(`App mode: ${appMode}, Preview mode: ${isPreview}`);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';

  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const task = useAppSelector(selectAuthTask);
  const user = useAppSelector(selectUser);
  const termsAccepted = useAppSelector(selectTermsAccepted);

  const [_localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const referralCode = params.get('ref') || params.get('referral');
    if (referralCode && isJapanese) {
      try {
        localStorage.setItem(PENDING_REFERRAL_CODE_STORAGE_KEY, referralCode);
      } catch (error) {
        console.warn('Failed to save referral code to localStorage:', error);
      }
    } else if (!isJapanese) {
      try {
        localStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear referral code from localStorage:', error);
      }
    }
  }, [isJapanese, location.search]);

  const handleGoogleLogin = async () => {
    setLocalError(null);
    dispatch(resetTask());
    console.log('Attempting Google sign-in...');
    dispatch(signInWithGoogle());
  };

  // watch for error
  // ログイン成功/失敗時の処理 (useEffectでtaskを監視)
  useEffect(() => {
    // task 状態に基づいてエラー表示や画面遷移を行う
    if (task === 'google_signin_error') {
      // 空メッセージはユーザー起因のキャンセル（auth/cancelled-popup-request 等）なので無視
      if (!authError) {
        return;
      }
      setLocalError(authError);
      notifications.show({
        title: t('auth.signInError'),
        message: authError,
        color: 'red',
        position: 'top-center',
        autoClose: 5000,
        withCloseButton: true,
        icon: <IconExclamationCircle size={16} />,
      });
    } else {
      setLocalError(null); // エラーがなければクリア
    }

    // ログイン成功時の遷移ロジック
    if (task === 'google_signin_success') {
      console.log(
        `Login successful (Task: ${task}). Checking terms... Terms accepted: ${termsAccepted}`
      );
      if (user.uid) {
        // ユーザーが存在することを確認
        // isNewUser フラグは signInWithGoogle の fulfilled payload に一時的に含まれるが、
        // Redux state には直接保存しない方針。
        // そのため、遷移は termsAccepted 状態のみで判断する。
        // loader があれば loader がリダイレクトを担うが、念のためここでもチェック。
        const destination =
          termsAccepted === false ? '/terms' : location.state?.from || APP_DEFAULT_PATH;
        console.log(`Navigating to: ${destination}`);
        navigate(destination, { replace: true });
        // 遷移後に task をリセット (任意)
        // dispatch(resetTask());
      } else {
        // ログイン成功したはずなのにユーザー情報がない場合 (予期せぬケース)
        console.error('Login reported success, but user data is missing in Redux state.');
        setLocalError(t('auth.signInUnexpectedError'));
      }
    }

    // このページに来た時点で不要になったタスク状態をリセット（任意）
    // return () => {
    //   if (task === 'signin_success' || task === 'google_signin_success' || task === 'signin_error' || task === 'google_signin_error') {
    //     dispatch(resetTask());
    //   }
    // };
  }, [task, authError, user, termsAccepted, navigate, location, dispatch, t]);

  // ページ読み込み時に前のエラーが残っていればクリア（任意）
  useEffect(() => {
    dispatch(resetTask());
    setLocalError(null);
  }, [dispatch]);

  return (
    <Container>
      <div className={classes.wrapper}>
        <Paper className={classes.form} radius={0} p={30}>
          <LoadingOverlay
            visible={isLoading}
            zIndex={1000}
            overlayProps={{ radius: 'sm', blur: 2 }}
          />
          <Title order={2} className={classes.title} ta="center" mt="md" mb={50}>
            {t('auth.signInToTorai')}
          </Title>
          <Box className={classes.googleSigninBox}>
            <Button
              className={classes.googleButton}
              onClick={handleGoogleLogin}
              disabled={isLoading}
              fullWidth
              mt="xl"
              size="md"
            >
              {t('auth.signInWithGoogle')}
            </Button>
            <img className={classes.signinImage} src={signinImage} alt={t('auth.signInGuide')} />
          </Box>
          {isJapanese && (
            <Text ta="center" mt="md">
              <Text
                component="a"
                className={classes.linkText}
                onClick={() => navigate('/auth/signin-with-mail-address')}
              >
                <IconMail size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                {t('auth.signInWithEmailLink')}
              </Text>
            </Text>
          )}
        </Paper>
      </div>
    </Container>
  );
}
