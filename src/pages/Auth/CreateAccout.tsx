import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconExclamationCircle, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Anchor,
  Box,
  Button,
  Checkbox,
  Container,
  Group,
  LoadingOverlay,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { APP_DEFAULT_PATH } from '@/config';
// 既存のプロジェクトに同様のユーティリティファイルがあることを想定
// もし存在しない場合は、PasswordChange.tsx からこれらの関数をコピーして
// src/utils/password-validation.ts のようなファイルに配置してください。
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  resetTask,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
} from '@/store/reducers/auth';
import { signUpWithEmailAndPassword } from '@/store/reducers/auth/authThunks';
import {
  isLowercaseChar,
  isNumber,
  isSpecialChar,
  isUppercaseChar,
  minLength,
} from '@/utils/password-validation';

type SignUpFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  termsOfService: boolean;
  privacyPolicy: boolean;
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const schema = useMemo(
    () =>
      z
        .object({
          email: z.string().email({ message: t('auth.validation.validEmail') }),
          password: z
            .string()
            .min(8, t('auth.validation.passwordMin8'))
            .regex(/[A-Z]/, t('auth.validation.passwordUppercase'))
            .regex(/[a-z]/, t('auth.validation.passwordLowercase'))
            .regex(/[0-9]/, t('auth.validation.passwordNumber'))
            .regex(/[~!@#$%^&*+\-?]/, t('auth.validation.passwordSymbol')),
          confirmPassword: z.string().min(1, { message: t('auth.validation.confirmPassword') }),
          termsOfService: z.boolean().refine((value) => value === true, {
            message: t('auth.validation.acceptTerms'),
          }),
          privacyPolicy: z.boolean().refine((value) => value === true, {
            message: t('auth.validation.acceptPrivacy'),
          }),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('auth.validation.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t]
  );

  useEffect(() => {
    if (!isJapanese) {
      navigate('/auth/signin', { replace: true });
    }
  }, [isJapanese, navigate]);

  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const task = useAppSelector(selectAuthTask);

  const form = useForm<SignUpFormValues>({
    validate: zodResolver(schema),
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      termsOfService: false,
      privacyPolicy: false,
    },
    validateInputOnBlur: true,
    validateInputOnChange: ['password'], // パスワード入力中にリアルタイムで要件チェックを表示
  });

  const handleSubmit = async (values: SignUpFormValues) => {
    console.log('Form submitted:', values);
    dispatch(resetTask()); // 前回のタスク状態をリセット
    try {
      await dispatch(
        signUpWithEmailAndPassword({ email: values.email, password: values.password })
      ).unwrap();
      // 成功時の処理は useEffect で task を監視して行う
    } catch (error: any) {
      // unwrap() がエラーをスローするのでここでキャッチ
      // エラー通知は useEffect で authError を監視して行う
      console.error('Sign up failed in handleSubmit:', error);
      // 必要であれば、ここでローカルなエラー表示を行うことも可能
      // setErrorState(typeof error === 'string' ? error : 'アカウント作成に失敗しました。');
    }
  };

  // task と authError の変更を監視して通知とナビゲーションを行う
  useEffect(() => {
    if (task === 'signup') {
      notifications.show({
        id: 'signup-loading',
        loading: true,
        title: t('auth.creatingAccount'),
        message: t('auth.creatingAccountMessage'),
        autoClose: false,
        withCloseButton: false,
      });
    } else if (task === 'signup_success') {
      notifications.update({
        id: 'signup-loading',
        color: 'green',
        title: t('auth.accountCreated'),
        message: t('auth.accountCreatedMessage'),
        icon: <IconCheck size={16} />,
        autoClose: 5000,
      });
      navigate(APP_DEFAULT_PATH, { replace: true }); // デフォルトルートへ遷移
    } else if (task === 'signup_error' && authError) {
      notifications.update({
        id: 'signup-loading', // ローディング通知を更新
        color: 'red',
        title: t('auth.accountCreationError'),
        message: authError,
        icon: <IconExclamationCircle size={16} />,
        autoClose: 7000,
      });
    }

    // このページを離れる時や、タスクが完了した時に通知を隠す (任意)
    // return () => {
    //   if (task === 'signup_success' || task === 'signup_error') {
    //     notifications.hide('signup-loading');
    //     dispatch(resetTask()); // タスク状態をリセット
    //   }
    // };
  }, [task, authError, navigate, dispatch, t]);

  const PasswordRequirement = ({ meets, label }: { meets: boolean; label: string }) => (
    <Text component="div" c={meets ? 'teal' : 'red'} mt={5} size="sm">
      <Group gap="xs" wrap="nowrap">
        {meets ? <IconCheck size="0.9rem" /> : <IconX size="0.9rem" />}
        <Box component="span" style={{ whiteSpace: 'nowrap' }}>
          {label}
        </Box>
      </Group>
    </Text>
  );

  const passwordRequirements = [
    { re: (val: string) => minLength(val), label: t('auth.requirements.min8') },
    { re: (val: string) => isUppercaseChar(val), label: t('auth.requirements.uppercase') },
    { re: (val: string) => isLowercaseChar(val), label: t('auth.requirements.lowercase') },
    { re: (val: string) => isNumber(val), label: t('auth.requirements.number') },
    { re: (val: string) => isSpecialChar(val), label: t('auth.requirements.symbol') },
  ];

  const checks = passwordRequirements.map((requirement, index) => (
    <PasswordRequirement
      key={index}
      label={requirement.label}
      meets={requirement.re(form.values.password)}
    />
  ));

  if (!isJapanese) {
    return null;
  }

  return (
    <Container size={460} my={40}>
      <Title ta="center">{t('auth.createNewAccount')}</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t('auth.alreadyHaveAccount')}{' '}
        <Anchor size="sm" component="button" onClick={() => navigate('/auth/signin')}>
          {t('auth.signIn')}
        </Anchor>
      </Text>
      <Text c="red" size="sm" ta="center" mt={5} fw="bolder">
        {t('auth.googleAccountNotice')}
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <LoadingOverlay
          visible={isLoading && task === 'signup'}
          zIndex={1000}
          overlayProps={{ radius: 'sm', blur: 2 }}
        />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              required
              label={t('auth.email')}
              placeholder="your@email.com"
              {...form.getInputProps('email')}
            />
            <PasswordInput
              required
              label={t('auth.password')}
              placeholder={t('auth.enterPassword')}
              {...form.getInputProps('password')}
            />
            {form.values.password !== '' && <Box mt="xs">{checks}</Box>}
            <PasswordInput
              required
              label={t('auth.confirmPassword')}
              placeholder={t('auth.reenterPassword')}
              {...form.getInputProps('confirmPassword')}
            />
            <Checkbox
              mt="md"
              label={
                <>
                  <Anchor
                    href={`https://doc-torai.try-try.com/terms-and-conditions${i18n.resolvedLanguage === 'ja' ? '-ja' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    inherit
                  >
                    {t('guest.terms')}
                  </Anchor>
                  {t('auth.agreeSuffix')}
                </>
              }
              {...form.getInputProps('termsOfService', { type: 'checkbox' })}
            />
            <Checkbox
              mt="xs"
              label={
                <>
                  <Anchor
                    href={`https://doc-torai.try-try.com/privacy-policy${i18n.resolvedLanguage === 'ja' ? '-ja' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    inherit
                  >
                    {t('guest.privacyPolicy')}
                  </Anchor>
                  {t('auth.agreeSuffix')}
                </>
              }
              {...form.getInputProps('privacyPolicy', { type: 'checkbox' })}
            />
          </Stack>
          <Button fullWidth mt="xl" type="submit" disabled={!form.isValid()}>
            {t('auth.register')}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
