// src/layouts/BlankPage/index.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mantine/core';

// ==============================|| BLANK LAYOUT ||============================== //

/**
 * ヘッダーやサイドバーのないシンプルなレイアウト。
 * 主にログインページやパスワードリセットページなどで使用されます。
 * このレイアウトが表示されるルートは、通常 GuestGuard (または同等の loader) によって
 * 認証済みユーザーのリダイレクトが行われるため、
 * このコンポーネント内で認証状態をチェックする必要はありません。
 */
const BlankPage = () => {
  return (
    <Box
      style={{
        minHeight: '100vh', // 画面全体の高さを確保
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center', // 垂直方向中央揃え (任意)
        alignItems: 'center', // 水平方向中央揃え (任意)
        // 必要に応じて背景色などを設定
        // bgcolor: 'grey.100'
      }}
    >
      {/* 子ルートのコンポーネント (例: SignInページ) を描画 */}
      <Outlet />
    </Box>
  );
};

export default BlankPage;
