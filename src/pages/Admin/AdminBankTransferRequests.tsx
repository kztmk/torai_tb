// src/pages/Admin/AdminBankTransferRequests.tsx (新規作成)
import React, { useEffect, useState } from 'react';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { Alert, Badge, Button, Group, Paper, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks'; // Import Redux hooks
import {
  approveBankTransferRequestThunk, // 作成したThunkをインポート
  fetchPendingBankTransferRequestsThunk,
  rejectBankTransferRequestThunk, // 差し戻し用Thunkをインポート (仮の名称)
} from '@/store/reducers/admin/adminThunks';

interface RejectReasonFormProps {
  requestId: string;
  onSubmit: (reason: string) => Promise<void>;
}

const RejectReasonForm: React.FC<RejectReasonFormProps> = ({ requestId: _requestId, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedReason = reason.trim();

  const handleSubmit = async () => {
    if (!trimmedReason) {
      notifications.show({
        color: 'red',
        title: '入力エラー',
        message: '差し戻し理由を入力してください。',
        icon: <IconAlertCircle size="1rem" />,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(trimmedReason);
      modals.closeAll();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        この内容はユーザーの振込名義入力画面に表示され、メールでも通知されます。
      </Text>
      <Textarea
        label="差し戻し理由"
        placeholder="例: 振込名義が申請内容と一致しませんでした。振込時の名義を確認して再申請してください。"
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        minRows={4}
        maxRows={8}
        maxLength={1000}
        required
        autosize
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.closeAll()} disabled={isSubmitting}>
          キャンセル
        </Button>
        <Button color="orange" onClick={handleSubmit} loading={isSubmitting}>
          差し戻す
        </Button>
      </Group>
    </Stack>
  );
};

const AdminBankTransferRequestsContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    pendingBankTransferRequests: requests,
    loading,
    error,
  } = useAppSelector((state) => state.admin);

  // 'approving' または 'rejecting' のアクションタイプとリクエストIDを管理
  const [processingRequest, setProcessingRequest] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);

  const fetchPendingRequests = () => {
    dispatch(fetchPendingBankTransferRequestsThunk());
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [dispatch]);

  const handleConfirmRequest = async (requestId: string) => {
    setProcessingRequest({ id: requestId, action: 'approve' });
    const notificationId = notifications.show({
      loading: true,
      title: '処理中...',
      message: `リクエストID: ${requestId} の承認処理を実行しています。`,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      await dispatch(approveBankTransferRequestThunk(requestId)).unwrap();
      notifications.update({
        id: notificationId,
        color: 'teal',
        title: '承認完了',
        message: `リクエストID: ${requestId} の承認が完了しました。プランが有効化されました。`,
        icon: <IconCheck size="1rem" />,
        autoClose: 5000,
      });
      fetchPendingRequests(); // リストを再取得して更新
    } catch (err: any) {
      const errorPayload = err as { message: string; requestId?: string };
      notifications.update({
        id: notificationId,
        color: 'red',
        title: '承認エラー',
        message: `リクエストID: ${requestId} の承認に失敗しました。理由: ${errorPayload.message || '不明なエラー'}`,
        icon: <IconAlertCircle size="1rem" />,
        autoClose: 7000,
      });
      console.error('Failed to approve request:', errorPayload);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: string, rejectionReason: string) => {
    setProcessingRequest({ id: requestId, action: 'reject' });
    const notificationId = notifications.show({
      loading: true,
      title: '処理中...',
      message: `リクエストID: ${requestId} の差し戻し処理を実行しています。`,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      await dispatch(rejectBankTransferRequestThunk({ requestId, rejectionReason })).unwrap();
      notifications.update({
        id: notificationId,
        color: 'orange', // 差し戻しはオレンジ色など
        title: '差し戻し完了',
        message: `リクエストID: ${requestId} の差し戻しが完了しました。ユーザーステータスが更新されました。`,
        icon: <IconCheck size="1rem" />, // または別の適切なアイコン
        autoClose: 5000,
      });
      fetchPendingRequests(); // リストを再取得して更新
    } catch (err: any) {
      const errorPayload = err as { message: string; requestId?: string };
      notifications.update({
        id: notificationId,
        color: 'red',
        title: '差し戻しエラー',
        message: `リクエストID: ${requestId} の差し戻しに失敗しました。理由: ${errorPayload.message || '不明なエラー'}`,
        icon: <IconAlertCircle size="1rem" />,
        autoClose: 7000,
      });
      console.error('Failed to reject request:', errorPayload);
      throw err;
    } finally {
      setProcessingRequest(null);
    }
  };

  const openRejectModal = (requestId: string) => {
    modals.open({
      title: '銀行振込確認依頼の差し戻し',
      centered: true,
      children: <RejectReasonForm requestId={requestId} onSubmit={(reason) => handleRejectRequest(requestId, reason)} />,
    });
  };

  if (loading === 'pending' || loading === 'idle') {
    return <Text>読み込み中...</Text>;
  }

  if (loading === 'failed' && error) {
    return (
      <Alert title="エラー" color="red" icon={<IconAlertCircle />}>
        {error}
      </Alert>
    );
  }

  const rows = requests.map((request) => (
    <Table.Tr key={request.id}>
      <Table.Td>{request.id}</Table.Td>
      <Table.Td>{request.userDisplayName || request.uid}</Table.Td>
      <Table.Td>{request.userEmail}</Table.Td>
      <Table.Td>{request.transferName}</Table.Td>
      <Table.Td>{request.planId}</Table.Td>
      <Table.Td>{request.amount.toLocaleString()}円</Table.Td>
      <Table.Td>{request.requestedAt}</Table.Td>
      <Table.Td>
        <Badge color={request.requestType === 'initial' ? 'blue' : 'grape'}>
          {request.requestType === 'initial' ? '初回' : '更新'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Button
            size="xs"
            color="teal"
            onClick={() => handleConfirmRequest(request.id)}
            loading={
              processingRequest?.id === request.id && processingRequest?.action === 'approve'
            }
            disabled={!!processingRequest} // 何かしらの処理中は全てのボタンを無効化
          >
            確認済にする
          </Button>
          <Button
            size="xs"
            color="orange"
            onClick={() => openRejectModal(request.id)}
            loading={processingRequest?.id === request.id && processingRequest?.action === 'reject'}
            disabled={!!processingRequest} // 何かしらの処理中は全てのボタンを無効化
          >
            差し戻し
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper p="md" shadow="xs">
      <Title order={2} mb="md">
        銀行振込 確認待ちリクエスト
      </Title>
      {requests.length === 0 ? (
        <Text>現在、確認待ちの振込リクエストはありません。</Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>リクエストID</Table.Th>
                <Table.Th>ユーザー</Table.Th>
                <Table.Th>メール</Table.Th>
                <Table.Th>振込名義</Table.Th>
                <Table.Th>プランID</Table.Th>
                <Table.Th>金額</Table.Th>
                <Table.Th>リクエスト日時</Table.Th>
                <Table.Th>種別</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Button onClick={fetchPendingRequests} mt="md">
        リストを更新
      </Button>
    </Paper>
  );
};

const AdminBankTransferRequests: React.FC = () => {
  const { i18n } = useTranslation();

  return i18n.resolvedLanguage === 'ja' ? (
    <AdminBankTransferRequestsContent />
  ) : (
    <Navigate to="/admin/subscriptions" replace />
  );
};

export default AdminBankTransferRequests;
