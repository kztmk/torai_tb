// src/pages/TermsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, List, Paper, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  acceptTerms,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
  selectUser,
  signOut,
} from '@/store/reducers/auth';
import TermsBodyEn from './TermsBodyEn';

const TermsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isLoading = useAppSelector(selectAuthLoading); // 全体のローディング状態
  const acceptTermsLoading = useAppSelector((state) => state.auth.task === 'accept_terms'); // 同意処理中のローディング
  const signOutLoading = useAppSelector((state) => state.auth.task === 'signout'); // ログアウト処理中のローディング
  const task = useAppSelector(selectAuthTask);
  const error = useAppSelector(selectAuthError);
  const user = useAppSelector(selectUser);

  // 同意後のリダイレクト先 (loaderから渡された情報やデフォルトパスを使う)
  // loaderを使わない場合は location.state から取得することも可能
  // const from = location.state?.from || '/dashboard'; // デフォルトはダッシュボードへ
  const from = '/dashboard'; // loaderを使う場合はシンプルに固定でも良い

  const [localError, setLocalError] = useState<string | null>(null);

  // 同意処理
  const handleAcceptTerms = () => {
    setLocalError(null); // エラー表示をクリア
    console.log(`User ${user.uid} accepting terms...`);
    dispatch(acceptTerms());
  };

  // 同意しない (ログアウト) 処理
  const handleDeclineTerms = async () => {
    setLocalError(null);
    console.log(`User ${user.uid} declining terms and signing out...`);
    try {
      await dispatch(signOut()).unwrap();
    } catch (error) {
      setLocalError(typeof error === 'string' ? error : t('terms.signOutFailed'));
    }
  };

  // タスク完了/エラー状態の監視
  useEffect(() => {
    // 同意成功 -> ダッシュボードへ遷移
    if (task === 'accept_terms_success') {
      console.log('Terms accepted successfully, navigating to dashboard...');
      navigate(from, { replace: true });
    }
    // ログアウト成功 -> ログインページへ遷移
    if (task === 'signout_success') {
      console.log('Sign out successful, navigating to signin...');
      navigate('/auth/signin', { replace: true });
    }
    // エラーがあれば表示 (acceptTerms or signOut)
    if (task === 'accept_terms_error' || task === 'signout_error') {
      setLocalError(error || 'An unexpected error occurred.');
    }

    // task 完了後に task state をリセットしたい場合は別途 dispatch する
    // dispatch(resetTask()); // 例: エラー表示後など
  }, [task, error, navigate, from, dispatch]); // dispatch も依存配列に追加

  return (
    <Paper p="xl" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Text mb="sm" mx="lg" component="h1" size="xl" fw={700}>
        {t('terms.title')}
      </Text>
      <Text mb="sm" mx="lg" variant="body1" m="md">
        {t('terms.welcome', { name: user.displayName || user.email })}
      </Text>
      {!user.termsAccepted && (
        <Text mb="sm" mx="lg" variant="body2">
          {t('terms.mustAgree')}
        </Text>
      )}

      {/* エラー表示 */}
      {localError !== null && (
        <Alert color="red" style={{ width: '100%', mb: 2 }}>
          {localError}
        </Alert>
      )}

      {/* 規約本文表示エリア */}
      <Box
        style={{
          height: '300px', // 高さを固定
          overflowY: 'scroll', // スクロール可能に
          border: '1px solid #ccc', // 境界線を追加
          borderRadius: '8px', // 角を丸く
          padding: '16px', // 内側の余白
          p: 'md',
          m: 'md',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {i18n.resolvedLanguage === 'en' ? <TermsBodyEn /> : <><Title my="md" order={1}>
          利用規約
        </Title>
        <Text mb="sm" mx="lg">
          最終更新日：2025年4月12日
        </Text>
        <Title my="md" order={2}>
          1. 総則
        </Title>
        <Text mb="sm" mx="lg">
          本利用規約（以下「本規約」といいます）は、今北産業（以下「当社」といいます）が提供するWebアプリケーション「虎威」（以下「本サービス」といいます）の利用条件を定めるものです。
          {'\n'}
          本サービスは、日本国およびカナダの各種法令に準拠して運営されます。利用者は本規約に同意した上で、本サービスをご利用いただくものとします。
        </Text>
        <Title my="md" order={2}>
          2. 定義
        </Title>
        <Text mb="sm" mx="lg">
          1.&nbsp;&nbsp;
          <Text span fw={700}>
            利用者
            <br />
          </Text>
          本サービスにアクセスし、利用する全ての個人または法人をいいます。
        </Text>
        <Text mb="sm" mx="lg">
          2.&nbsp;&nbsp;
          <Text span fw={700}>
            Googleアカウント
            <br />
          </Text>
          Googleが提供する認証サービスを利用したアカウントをいいます。
          <br />
          ※本サービスへのログインおよび利用は、Googleアカウントを用いて行います。
        </Text>
        <Text mb="sm" mx="lg">
          3. &nbsp;&nbsp;
          <Text span fw={700}>
            登録情報
            <br />
          </Text>
          本サービスへの登録時、利用者が提供する以下の情報を指します：
        </Text>
        <List mx="lg" my="md">
          <List.Item>Googleアカウント情報</List.Item>
          <List.Item>入力されたユーザー名および肩書き</List.Item>
          <List.Item>Google SheetのApps ScriptのURL</List.Item>
          <List.Item>各AIプロバイダーのAPIキー（AI利用の場合）</List.Item>
        </List></>}
        <Text mb="sm" mx="lg">
          4.&nbsp;&nbsp;
          <Text span fw={700}>
            Xアカウント関連情報
            <br />
          </Text>
          Xアカウント、Xへのポストに関連する情報は、本サービスが直接記録または管理しません。利用者が所有するGoogleシートおよびGoogleドライブ上に保存される情報をいいます。
        </Text>
        <Title my="md" order={2}>
          3. アカウント登録および利用
        </Title>
        <Text mb="sm" mx="lg">
          1.&nbsp;&nbsp;
          <Text span fw={700}>
            登録方法
            <br />
          </Text>
          本サービスはGoogleアカウントによる認証方式を採用しております。利用者は、正確かつ最新の情報を提供の上で登録手続きを行ってください。
        </Text>
        <Text mb="sm" mx="lg">
          2. &nbsp;&nbsp;
          <Text span fw={700}>
            提供情報の取り扱い
            <br />
          </Text>
          利用者が登録の際に提供する情報（Googleアカウント、ユーザー名、肩書き、Google
          Sheet、各AIプロバイダーのAPIキー）は、本サービスの提供および運営改善のために利用され、法令に基づき厳正に管理されます。
        </Text>
        <Text mb="sm" mx="lg">
          3. &nbsp;&nbsp;
          <Text span fw={700}>
            Xアカウント関連データの保存
            <br />
          </Text>
          Xアカウントに関する情報は、当社のシステムに記録されることなく、全て利用者が所有するGoogleシートおよびGoogleドライブ上で管理されるものとします。
        </Text>
        <Title my="md" order={2}>
          4. プライバシーと個人情報の保護
        </Title>
        <Text mb="sm" mx="lg">
          当社は、利用者の個人情報および登録情報を適切に管理し、漏洩、不正アクセス、改ざん等を防止するための安全管理措置を講じます。
        </Text>
        <Text mb="sm" mx="lg">
          収集した情報は、本サービスの提供、改善、及び法令に基づく場合を除き、第三者へ提供または開示されることはありません。
        </Text>
        <Title my="md" order={2}>
          5. ニュースレター配信について
        </Title>
        <Text mb="sm" mx="lg">
          1.
          利用者が本サービスに登録する際、その購入時のメールアドレス、または、Googleアカウント宛に当社からのニュースレターおよび各種お知らせを配信することに同意したものとみなします。
        </Text>
        <Text mb="sm" mx="lg">
          2.
          利用者は、登録後いつでも設定変更または配信解除手続きを行うことで、ニュースレターの受信を停止することができます。具体的な解除方法は、本サービス内の「配信停止手続き」または当社へのお問い合わせによりご案内いたします。
        </Text>
        <Title my="md" order={2}>
          6. 利用条件および禁止事項
        </Title>
        <Text mb="sm" mx="lg">
          1. &nbsp;&nbsp;
          <Text span fw={700}>
            利用条件
            <br />
          </Text>
          利用者は、本サービスを自己の責任において利用するものとし、当社は本サービスの利用に起因して生じた損害（直接的・間接的）に対して一切の責任を負いません。
        </Text>
        <Text mb="sm" mx="lg">
          2. &nbsp;&nbsp;
          <Text span fw={700}>
            禁止事項
            <br />
          </Text>
          利用者は、以下の行為を禁止します：
        </Text>
        <List mx="lg" my="md">
          <List.Item>虚偽の情報の提供または不正確な登録情報の入力</List.Item>
          <List.Item>他者の権利（知的財産権、プライバシー権等）を侵害する行為</List.Item>
          <List.Item>
            不正アクセス、当社のシステムへの攻撃、またはその他本サービスの運営を妨げる行為
          </List.Item>
          <List.Item>その他、社会通念上不適切または当社が不適切と判断する行為</List.Item>
        </List>
        <Text mb="sm" mx="lg">
          当社は、利用者が本規約に違反した場合、事前の通知なく利用登録の解除、または本サービスの利用制限を行う権利を有します。
        </Text>
        <Title my="md" order={2}>
          7. 知的財産権
        </Title>
        <Text mb="sm" mx="lg">
          1.
          本サービスに関する著作権、商標権、及びその他の知的財産権は、当社または正当な権利者に帰属します。
        </Text>
        <Text mb="sm" mx="lg">
          2. 利用者は、当社または第三者の知的財産権を侵害する行為を行ってはなりません。
        </Text>
        <Title my="md" order={2}>
          8. 免責事項
        </Title>
        <Text mb="sm" mx="lg">
          1.
          当社は、本サービスに掲載される情報の正確性、完全性、有用性について万全を期しておりますが、それらについて明示または黙示の保証を行うものではありません。
        </Text>
        <Text mb="sm" mx="lg">
          2.
          天災、システム障害、その他不可抗力により本サービスの利用が困難となった場合、当社は一切の責任を負いません。
        </Text>
        <Title my="md" order={2}>
          9. 規約の変更
        </Title>
        <Text mb="sm" mx="lg">
          1.
          当社は、本サービスの運営上必要と判断した場合、利用者に事前通知することなく本規約を改定することがあります。
        </Text>
        <Text mb="sm" mx="lg">
          2.
          改定後の本規約は、本サービス上での公示またはその他の方法で利用者に通知された時点で効力を生じるものとします。
        </Text>
        <Title my="md" order={2}>
          10. 準拠法および裁判管轄
        </Title>
        <Text mb="sm" mx="lg">
          1.
          これらの法的条件は、カナダの法律に従って解釈され、定義されます。今北産業およびあなたは、これらの法的条件に関連して生じる可能性のある紛争を解決するために、カナダの裁判所に排他的管轄権を有することに無条件に同意します。
        </Text>
        <Text mb="sm" mx="lg">
          2. 利用者と当社との間で生じた紛争については、当社の所在地（British
          Columbia）の管轄裁判所を専属的合意管轄裁判所とします。
        </Text>
        <Title my="md" order={2}>
          11. お問い合わせ先
        </Title>
        <Text mb="sm" mx="lg">
          本規約に関するご質問、ならびにニュースレターの配信解除に関するお問い合わせは、下記までご連絡ください。
        </Text>
        <List mx="lg" my="md">
          <List.Item>会社名：今北産業</List.Item>
          <List.Item>
            所在地：1771 Robson Street Unit 1827
            <br />
            Vancouver, British Columbia V6G 3B7 Canada
          </List.Item>
          <List.Item>電話番号：1-672-514-5235</List.Item>
          <List.Item>メールアドレス：support@imakita3gyo.com</List.Item>
        </List>
      </Box>

      {/* 同意/拒否ボタン */}
      {!user.termsAccepted && (
        <Box
          mt="md"
          style={{ display: 'flex', justifyContent: 'space-around', width: '80%', gap: '1rem' }}
        >
          {/* LoadingButton があれば使う */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleAcceptTerms}
            loading={acceptTermsLoading} // 同意処理中のみローディング
            disabled={isLoading} // 他の処理中でも無効化
            style={{ flexGrow: 1, mx: 1 }}
          >
            {t('terms.accept')}
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={handleDeclineTerms}
            disabled={isLoading || signOutLoading} // 他の処理中やログアウト中は無効化
            style={{ flexGrow: 1, mx: 1 }}
          >
            {t('terms.decline')}
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default TermsPage;
