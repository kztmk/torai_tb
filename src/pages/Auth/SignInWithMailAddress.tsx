import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconExclamationCircle } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Button,
  Checkbox,
  Container,
  LoadingOverlay,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { APP_DEFAULT_PATH } from '@/config';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  resetTask,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
  selectTermsAccepted,
  selectUser,
  signIn,
} from '@/store/reducers/auth';
import classes from './SignInImage.module.css';

type FormValues = { email: string; password: string; rememberMe?: boolean };

export default function SignInWithMailAddress() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t('auth.validation.validEmail') }),
        password: z.string().min(6, { message: t('auth.validation.passwordMin6') }),
        rememberMe: z.boolean().optional(),
      }),
    [t]
  );

  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const task = useAppSelector(selectAuthTask);
  const user = useAppSelector(selectUser);
  const termsAccepted = useAppSelector(selectTermsAccepted);

  const [_localError, setLocalError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validate: zodResolver(schema),
  });

  useEffect(() => {
    try {
      const signinInfo = localStorage.getItem('signinInfo');
      if (signinInfo) {
        const { email, rememberMe } = JSON.parse(signinInfo);
        if (rememberMe) {
          form.setValues({ email, password: '', rememberMe });
        }
      }
    } catch (error) {
      console.warn('Failed to load signinInfo from localStorage:', error);
      try {
        localStorage.removeItem('signinInfo');
      } catch (removeError) {
        console.warn('Failed to remove signinInfo from localStorage:', removeError);
      }
    }
  }, []);

  useEffect(() => {
    if (task === 'signin_error') {
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
      setLocalError(null);
    }

    if (task === 'signin_success') {
      if (user.uid) {
        const destination =
          termsAccepted === false ? '/terms' : location.state?.from || APP_DEFAULT_PATH;
        navigate(destination, { replace: true });
      } else {
        console.error('Login reported success, but user data is missing in Redux state.');
        setLocalError(t('auth.signInUnexpectedError'));
      }
    }
  }, [task, authError, user, termsAccepted, navigate, location, t]);

  const handleSubmit = async (values: FormValues) => {
    try {
      if (values.rememberMe) {
        localStorage.setItem(
          'signinInfo',
          JSON.stringify({ email: values.email, rememberMe: true })
        );
      } else {
        localStorage.removeItem('signinInfo');
      }
    } catch (error) {
      console.warn('Failed to save signinInfo to localStorage:', error);
    }
    setLocalError(null);
    dispatch(resetTask());
    try {
      console.log('Attempting email/password sign in...');
      await dispatch(signIn({ email: values.email, password: values.password })).unwrap();
    } catch (err: any) {
      console.error('Email/password sign in failed:', err);
      const errorMessage = typeof err === 'string' ? err : t('auth.signInFailed');
      setLocalError(errorMessage);
    }
  };

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
            {t('auth.signInWithEmail')}
          </Title>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <TextInput
              label={t('auth.email')}
              placeholder="hello@gmail.com"
              size="md"
              withAsterisk
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label={t('auth.password')}
              placeholder={t('auth.enterPassword')}
              mt="md"
              size="md"
              withAsterisk
              {...form.getInputProps('password')}
            />
            <Checkbox
              label={t('auth.rememberSignIn')}
              mt="xl"
              size="md"
              {...form.getInputProps('rememberMe', { type: 'checkbox' })}
            />
            <Button type="submit" fullWidth mt="xl" size="md">
              {t('auth.signIn')}
            </Button>
          </form>

          <Text ta="center" mt="md">
            {t('auth.forgotPasswordLead')}{' '}
            <Text
              component="a"
              className={classes.linkText}
              onClick={() => navigate('/auth/forgot-password')}
            >
              {t('auth.resetPassword')}
            </Text>
          </Text>
          <Text ta="center" mt="xs">
            {t('auth.googleSignInLead')}{' '}
            <Text
              component="a"
              className={classes.linkText}
              onClick={() => navigate('/auth/signin')}
            >
              {t('auth.here')}
            </Text>
          </Text>
        </Paper>
      </div>
    </Container>
  );
}
