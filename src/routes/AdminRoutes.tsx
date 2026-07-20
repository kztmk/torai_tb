import React, { lazy } from 'react';
import { redirect } from 'react-router-dom';
import Loadable from '@/components/Loader/Loaderble';
import { AdminLayout } from '@/layouts/AdminLayout';
import store from '@/store';
import { selectUser } from '@/store/reducers/auth';

const AdminBankTransferRequests = Loadable(
  lazy(() => import('@/pages/Admin/AdminBankTransferRequests'))
);
const AdminAccountsLock = Loadable(lazy(() => import('@/pages/Admin/AdminAccountsLock')));
const AdminMessages = Loadable(lazy(() => import('@/pages/Admin/AdminMessages')));
const AdminSubscriptionDashboard = Loadable(
  lazy(() => import('@/pages/Admin/AdminSubscriptionDashboard'))
);
const AdminXMarketingSamples = Loadable(lazy(() => import('@/pages/Admin/AdminXMarketingSamples')));
/**
 * 管理者ルート用のローダー関数
 * 認証状態と管理者権限をチェックします。
 */
export const adminLoader = async () => {
  const state = store.getState();
  const isAdmin = selectUser(state).isAdmin;

  if (!isAdmin) {
    // 管理者でない場合はトップページなどへリダイレクト
    return redirect('/dashboard');
  }

  return null;
};

export const AdminRoutes = [
  {
    path: 'admin',
    element: <AdminLayout />, // ★ 管理者ページ共通のレイアウト (任意)
    loader: adminLoader, // ★ すべてのadmin/* ルートに適用されるローダー
    children: [
      {
        index: true,
        element: <AdminBankTransferRequests />,
      },
      {
        path: 'bank-transfer-requests',
        element: <AdminBankTransferRequests />,
        // このルート固有のローダーが必要な場合はここにも追加可能
      },
      {
        path: 'accounts-lock',
        element: <AdminAccountsLock />,
      },
      {
        path: 'messages',
        element: <AdminMessages />,
      },
      {
        path: 'subscriptions',
        element: <AdminSubscriptionDashboard />,
      },
      {
        path: 'x-marketing-samples',
        element: <AdminXMarketingSamples />,
      },
      // 他の管理者用ルートをここに追加
    ],
  },
];
