// src/routes/index.tsx
import React, { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
// useRoutes の代わりに createBrowserRouter と RouterProvider を使う
import LoadingSpinner from '@/components/Loader/'; // ローディングスピナー

// --- Page Components (Lazy Loading) ---
import Loadable from '@/components/Loader/Loaderble'; // Loadable コンポーネント

// Auth Listener と Redux
import { useAppDispatch } from '@/hooks/rtkhooks';
import BlankPage from '@/layouts/BlankPage/';
// --- Layouts ---
import GuestPageLayout from '@/layouts/Guest';
import { MainLayout } from '@/layouts/MainLayout'; // MainLayout (名前付きエクスポートの場合)

import { listenAuthState } from '@/store/reducers/auth';
import { AdminRoutes } from './AdminRoutes'; // AdminRoutes から adminLoader をエクスポートしておく必要あり
import { protectedLoader } from './MainRoutes'; // MainRoutes から protectedLoader をエクスポートしておく必要あり

// --- Guards/Loaders & Auth ---
// Guards は削除
// import AuthGuard from '@/utils/route-guard/AuthGuard';
// import GuestGuard from '@/utils/route-guard/GuestGuard';
// loader関数をインポート (またはここで定義)
import { guestLoader } from './SignInRoutes';

// SignInRoutes から guestLoader をエクスポートしておく必要あり

const PagesLanding = Loadable(lazy(() => import('@/pages/HomePage'))); // Loadableでラップ
const NotFound404 = Loadable(lazy(() => import('@/pages/NotFound404')));
const AuthSignin = Loadable(lazy(() => import('@/pages/Auth/SignIn')));
const AuthSignInWithMailAddress = Loadable(
  lazy(() => import('@/pages/Auth/SignInWithMailAddress'))
);
const SignupPage = Loadable(lazy(() => import('@/pages/Auth/CreateAccout')));
const AuthForgotPassword = Loadable(lazy(() => import('@/pages/Auth/ForgotPassword')));
const EmailActionHandler = Loadable(lazy(() => import('@/pages/Auth/EmailActionHandler'))); // ★ 追加
const AuthResetPassword = Loadable(lazy(() => import('@/pages/Auth/ResetPassword')));
const Activity = Loadable(lazy(() => import('@/pages/Activity')));
const Dashboard = Loadable(lazy(() => import('@/pages/Dashboard')));
const MessagesPage = Loadable(lazy(() => import('@/pages/Messages')));
const ProfilePage = Loadable(lazy(() => import('@/pages/Profile')));
const TermsPage = Loadable(lazy(() => import('@/pages/Terms/TermsPage')));

// --- Auth Initializer Component ---
// アプリ全体で認証状態を監視し、初期ロード中にスピナーを表示する
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  // このコンポーネントでは、Firebaseの認証状態が最初に解決されるまでの
  // ローディングのみを扱う。Reduxの汎用的なloading状態はここでは見ない。
  // listenAuthStateが完了するまでは何らかのローディング状態が必要な場合、
  // listenAuthState自体が初期ロード完了を示す状態をReduxに持つと良い。
  //  const [isAuthResolved, setIsAuthResolved] = useState(false);
  useEffect(() => {
    console.log('AuthInitializer: Dispatching listenAuthState');
    // listenAuthState を実行し、認証状態の監視を開始
    // listenAuthState は unsubscribe 関数を返す想定
    const unsubscribe = dispatch(listenAuthState()) as unknown as () => void; // 型アサーション

    // コンポーネントのアンマウント時にリスナーを解除
    return () => {
      console.log('AuthInitializer: Unsubscribing from auth state changes');
      unsubscribe();
    };
  }, [dispatch]); // dispatch は通常変わらないが、念のため含める

  // Redux state の loading が true の間はローディング表示
  // if (isLoading) {
  //   console.log(
  //     'AuthInitializer: Auth state is loading (isLoading is true). Showing spinner AND rendering children to prevent unmounts.'
  //   );
  //   // ローディング中でも children (Outlet) をレンダリングし続けることで、
  //   // 子ルートのアンマウントを防ぐ。
  //   // ローディングスピナーは MainLayout など、より適切な場所で表示するか、
  //   // グローバルなオーバーレイとして表示することを検討。
  //   // ここでは、スピナーと子要素を両方レンダリングする形にするが、
  //   // UI/UX的にはスピナーがメインコンテンツを覆う形が良い。
  //   return <LoadingSpinner />;
  // }

  console.log('AuthInitializer: Auth state loaded, rendering children.');
  // ローディング完了後に子要素（Router）を描画
  return <>{children}</>;
};

// --- アプリケーション全体のルーター定義 (createBrowserRouterを使用) ---
const router = createBrowserRouter([
  {
    // ルートパス "/"
    // ここで基本的なレイアウトや認証初期化を行う
    // ErrorBoundary を設定することも推奨
    // errorElement: <GlobalErrorBoundary />,
    element: (
      // AuthInitializer で囲み、認証状態の監視と初期ロードを行う
      <AuthInitializer>
        {/* Outlet は子ルートを描画するためのプレースホルダー */}
        <Outlet />
      </AuthInitializer>
    ),
    children: [
      // --- Public Routes (Guest Layout) ---
      {
        // element に GuestPageLayout を指定し、その中で Outlet を使う
        element: <GuestPageLayout />,
        children: [
          {
            index: true, // path: '/' にマッチ
            element: <PagesLanding />,
            // loader は不要 (公開ページのため)
          },
          // 他の公開ページがあればここに追加
          // { path: 'about', element: <AboutPage /> }
        ],
      },

      // --- Guest Only Routes (Blank Layout, Sign In etc.) ---
      {
        // BlankPage レイアウトを適用し、guestLoaderで保護
        path: 'auth', // 親ルートに 'auth' を追加
        element: <BlankPage />,
        loader: guestLoader, // ★ 認証済みならリダイレクト
        children: [
          {
            path: 'signin',
            element: <AuthSignin />,
          },
          {
            path: 'signin-with-mail-address',
            element: <AuthSignInWithMailAddress />,
          },
          {
            path: 'signup',
            element: <SignupPage />,
          },
          {
            path: 'forgot-password',
            element: <AuthForgotPassword />,
          },
          {
            path: 'reset-password',
            element: <AuthResetPassword />,
          },
          {
            // ★ メールアドレス確認などのアクションを処理するルート
            path: 'action',
            element: <EmailActionHandler />,
          },
        ],
      },

      // --- Protected Routes (Main Layout) ---
      {
        // MainLayout を適用し、protectedLoaderで保護
        id: 'mainLayout', // <--- Add this ID
        element: <MainLayout />,
        errorElement: <BlankPage />,
        loader: protectedLoader, // ★ 未認証 or 未同意ならリダイレクト
        shouldRevalidate: ({ currentUrl, nextUrl, formData, formAction, formMethod }) => {
          // 以下の条件のいずれかがtrueの場合にのみローダーを再実行する
          // 1. フォーム送信があった場合 (action)
          // 2. URLのパス名が変更された場合
          // 3. URLの検索パラメータが変更された場合
          // これら以外の場合 (例: Reduxストアの一般的な状態変更のみ) ではローダーを再実行しない
          if (formAction || formData || formMethod) {
            return true;
          }
          if (currentUrl.pathname !== nextUrl.pathname) {
            return true;
          }
          if (currentUrl.search !== nextUrl.search) {
            return true;
          }
          return false; // 上記以外は再検証しない
        },
        children: [
          // MainRoutes.tsx で定義されていた子ルートをここに移動・展開
          {
            path: 'dashboard', // MainLayoutからの相対パス
            element: <Dashboard />,
            children: [
              {
                index: true,
                element: <Activity />,
              },
            ],
          },
          {
            path: 'profile', // MainLayoutからの相対パス
            element: <ProfilePage />,
          },
          {
            path: 'messages',
            element: <MessagesPage />,
          },
          {
            // 規約ページもこの loader で保護される
            path: 'terms', // MainLayoutからの相対パス
            element: <TermsPage />,
          },
          // 他の保護ルート
        ],
      },
      // --- Protected Admin Routes (Admin Layout) ---
      ...AdminRoutes,
      // --- Not Found Route ---
      // どのルートにもマッチしなかった場合に表示
      // 注意: loaderのあるルートよりも後に定義する必要がある場合がある
      {
        path: '*',
        element: <BlankPage />, // NotFound404 を BlankPage レイアウトで表示
        children: [{ path: '*', element: <NotFound404 /> }],
      },
    ],
  },
]);

// --- アプリケーションエントリーポイント ---
const ThemeRoutes = () => {
  // createBrowserRouter を RouterProvider に渡す
  // fallbackElement は Suspense の fallback としても機能するが、
  // loader 実行中の表示にも使われる
  return (
    // Suspense は lazy loading のために必要
    <Suspense fallback={<LoadingSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default ThemeRoutes;
