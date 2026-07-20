import React, { useEffect } from 'react';
import { UserSubscription } from '.'; // 親コンポーネントから型をインポート

import { IconAlertCircle } from '@tabler/icons-react';
import { Alert, Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  cancelBankTransferThunk,
  getUserProfile,
  requestBankTransferConfirmationThunk,
  resetTask,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
} from '@/store/reducers/auth';

/**
 * 文字列が振込名義として許可された文字種のみで構成されているかをチェック
 * 許可文字: 全角カタカナ(濁点・半濁点付き文字含む), 大文字アルファベット, 数字, スペース(全角/半角), ￥, ，, ．, （, ）, 「, 」, －, /, ゛, ゜
 */
function isAllowedTransferNameChars(input: string): boolean {
  // \u30A0-\u30FF: 全角カタカナ (例: アイウエオ, ガギグゲゴ, パピプペポ)
  // \u309B: 濁点 (゛)
  // \u309C: 半濁点 (゜)
  // \u3000 : 全角スペースと半角スペース
  const pattern = /^[A-Z0-9\u30A0-\u30FF\u309B\u309C\u3000 ¥￥，．（）「」－/]+$/;
  return pattern.test(input);
}

interface BankTransferRequestInfoProps {
  bankPaymentInfo: NonNullable<UserSubscription['bankPaymentInfo']>; // nullでないことを明示
  bankTransferName: string;
  setBankTransferName: (name: string) => void;
  onConfirmTransfer: (transferName: string) => void;
}

const BankTransferRequestInfo: React.FC<BankTransferRequestInfoProps> = ({
  bankPaymentInfo,
  bankTransferName,
  setBankTransferName,
}) => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const authTask = useAppSelector(selectAuthTask);

  // このコンポーネントに関連するローディング状態を判定
  const isConfirmationRequestLoading = isLoading && authTask === 'request_bank_confirmation';
  const isCancelLoading = isLoading && authTask === 'cancel_bank_transfer';
  const isProcessing = isConfirmationRequestLoading || isCancelLoading;

  useEffect(() => {
    if (authTask === 'request_bank_confirmation_success') {
      notifications.show({
        title: 'リクエスト送信完了',
        message: '振込完了の確認リクエストを受け付けました。確認が完了次第、ご連絡いたします。', // 必要であればCloud Functionからのメッセージを使う
        color: 'green',
      });
      // 入力フィールドをクリアするなどの処理
      // setBankTransferName(''); // BankTransferRequestInfo.tsx で管理している場合
      dispatch(resetTask()); // タスク状態をリセット
    } else if (authTask === 'request_bank_confirmation_error' && authError) {
      notifications.show({
        title: 'リクエスト送信エラー',
        message: authError,
        color: 'red',
      });
      dispatch(resetTask()); // タスク状態をリセット
    } else if (authTask === 'cancel_bank_transfer_error' && authError) {
      notifications.show({
        title: 'キャンセルエラー',
        message: authError,
        color: 'red',
      });
      dispatch(resetTask());
    }
  }, [authTask, authError, dispatch, setBankTransferName]);

  const handleConfirmClick = () => {
    // BankTransferRequestInfo.tsx の例
    if (!bankTransferName.trim()) {
      notifications.show({
        title: '入力エラー',
        message: '振込名義を入力してください。',
        color: 'red',
      });
      return;
    }

    if (!isAllowedTransferNameChars(bankTransferName)) {
      notifications.show({
        title: '入力エラー',
        message: `振込名義に使用できない文字が含まれています。許可される文字を確認してください。\n
        許可文字: 全角カタカナ(濁点・半濁点付き文字含む), 大文字アルファベット, 数字, スペース(全角/半角), ￥, ，, ．, （, ）, 「, 」, －, /, ゛, ゜`,
        color: 'red',
      });
      return;
    }

    // 既に処理中の場合は何もしない
    if (isProcessing) {
      return;
    }

    // 処理中通知 (任意)
    notifications.show({
      id: 'bank-transfer-confirmation-processing', // useEffectで表示する通知とIDを分けるか、ここで完結させる
      title: '処理中',
      message: '振込完了確認リクエストを送信しています...',
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    dispatch(requestBankTransferConfirmationThunk({ transferName: bankTransferName }))
      .unwrap() // unwrap() を使うと、fulfilled/rejected の結果を直接扱える
      .then(() => {
        // 成功時の処理 (通知はuseEffectに任せるので、ここでは主にローディング通知を隠す)
        notifications.hide('bank-transfer-confirmation-processing');
      })
      .catch(() => {
        // エラー時の処理 (通知はuseEffectに任せるので、ここでは主にローディング通知を隠す)
        notifications.hide('bank-transfer-confirmation-processing');
      });
  };

  const handleCancelClick = () => {
    if (isProcessing) {
      return;
    }

    modals.openConfirmModal({
      title: '銀行振込のお申込みをキャンセル',
      centered: true,
      children: (
        <Text size="sm">
          銀行振込のお申込みをキャンセルします。キャンセル後は、もう一度プランを選択できます。
        </Text>
      ),
      labels: { confirm: 'キャンセルする', cancel: '戻る' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        notifications.show({
          id: 'bank-transfer-cancel-processing',
          title: '処理中',
          message: '銀行振込のお申込みをキャンセルしています...',
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });

        dispatch(cancelBankTransferThunk())
          .unwrap()
          .then(() => {
            notifications.hide('bank-transfer-cancel-processing');
            notifications.show({
              title: 'キャンセル完了',
              message: '銀行振込のお申込みをキャンセルしました。',
              color: 'green',
            });
            setBankTransferName('');
            dispatch(getUserProfile());
            dispatch(resetTask());
          })
          .catch(() => {
            notifications.hide('bank-transfer-cancel-processing');
          });
      },
    });
  };

  const title =
    bankPaymentInfo.status === 'payment_requested'
      ? `${bankPaymentInfo.planName}のお申込み（銀行振込）ありがとうございます。`
      : bankPaymentInfo.status === 'renewal_requested'
        ? `${bankPaymentInfo.planName}の更新をお願いします。`
        : '';

  return (
    <Card withBorder radius="md" p="xl" mt="lg">
      <Stack align="center">
        <Title order={3} ta="center">
          銀行振込のお手続きについて
        </Title>
        {(bankPaymentInfo.status === 'payment_requested' ||
          bankPaymentInfo.status === 'renewal_requested') && (
          <>
            <Text ta="center" c="dimmed">
              {title}
            </Text>
            {bankPaymentInfo.rejectionReason && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="振込確認依頼が差し戻されました"
                color="orange"
                w="100%"
                maw={520}
              >
                <Text fw={700}>差し戻し理由</Text>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{bankPaymentInfo.rejectionReason}</Text>
                <Text mt="xs" size="sm">
                  内容をご確認のうえ、振込名義を入力して再度確認リクエストを送信してください。
                </Text>
              </Alert>
            )}
            <Text>
              ご登録のメールアドレス宛にお振込み情報をお送りしましたので、
              <br />
              期限（
              {bankPaymentInfo.paymentDeadline &&
                new Date(bankPaymentInfo.paymentDeadline).toLocaleDateString()}
              ）までにお手続きをお願いいたします。
            </Text>
            {typeof bankPaymentInfo.amount === 'number' && (
              <Text ta="center" fw={700}>
                お振込金額: {bankPaymentInfo.amount.toLocaleString()}円
                {bankPaymentInfo.firstMonthDiscountApplied && (
                  <Text component="span" c="green" fw={700}>
                    {' '}
                    （事務手数料免除）
                  </Text>
                )}
              </Text>
            )}
            {typeof bankPaymentInfo.referralCreditAppliedAmount === 'number' &&
              bankPaymentInfo.referralCreditAppliedAmount > 0 && (
                <Text ta="center" c="green" fw={700}>
                  紹介クレジット適用額:{' '}
                  {bankPaymentInfo.referralCreditAppliedAmount.toLocaleString()}円
                </Text>
              )}
            <Text ta="center" fw={500} mt="sm">
              お振込みが完了しましたら、下のボタンよりお知らせください。
            </Text>
            <TextInput
              label="振込名義"
              placeholder="振込時のお名前（全角カタカナ）"
              value={bankTransferName}
              onChange={(event) => setBankTransferName(event.currentTarget.value)}
              mt="md"
              required
              w="100%"
              maw={400}
              disabled={isProcessing}
            />
            <Group mt="md" justify="center">
              {bankPaymentInfo.status === 'payment_requested' && (
                <Button
                  onClick={handleCancelClick}
                  color="red"
                  variant="outline"
                  loading={isCancelLoading}
                  disabled={isProcessing}
                >
                  申込みをキャンセル
                </Button>
              )}
              <Button
                onClick={handleConfirmClick}
                color="green"
                loading={isConfirmationRequestLoading}
                disabled={isProcessing}
              >
                振込完了確認リクエスト
              </Button>
            </Group>
          </>
        )}
        {bankPaymentInfo.status === 'pending_confirmation' && (
          <Alert icon={<IconAlertCircle size="1rem" />} title="確認中" color="blue" mt="md">
            <Text>
              振込完了の確認リクエストを受け付けました。
              <br />
              現在、管理者による確認待ちです。確認が完了し次第、メールにてご連絡いたします。
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
};

export default BankTransferRequestInfo;
