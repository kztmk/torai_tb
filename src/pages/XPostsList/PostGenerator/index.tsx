import React, { useEffect, useState } from 'react';
import { Alert, Box, Container, Divider, Loader, Modal, Stack, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications'; // 通知用
import { useTranslation } from 'react-i18next';

// Redux関連のインポート
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks'; // useAppDispatch と useAppSelector をインポート
import {
  clearError,
  generatePostsThunk, // Sliceから PostData 型をインポート
  resetPostsState, // Resetアクションもインポート
  selectAllPosts,
  selectCurrentKeyword,
  selectPostsError,
  selectPostsLoadingStatus,
  setPostAdoption,
  updatePostText,
} from '@/store/reducers/generatedPostsSlice';
import { createMultiplePost, selectXPostsStatus } from '@/store/reducers/xPostsSlice';
import { XPostDataType } from '@/types/xAccounts';
import KeywordPanel from './KeywordPanel';
import PostDisplay from './PostDisplay'; // PostData 型はSliceからインポートしても良い

// Sliceのパスに合わせて調整
type PostGeneratorProps = {
  opened: boolean; // モーダルのオープン状態
  onClose: () => void; // モーダルを閉じる関数
  xAccountId: string; // XアカウントID
};
// PostsGeneratorコンポーネント
const PostsGenerator: React.FC<PostGeneratorProps> = (props) => {
  const { t } = useTranslation();
  const { opened, onClose, xAccountId } = props;
  // --- ローカルステート (キーワード入力用) ---
  const [keyword, setKeyword] = useState<string>('');

  // --- Redux Dispatch ---
  const dispatch = useAppDispatch();

  // --- Redux Storeからの状態選択 ---
  const posts = useAppSelector(selectAllPosts);
  const loadingStatus = useAppSelector(selectPostsLoadingStatus);
  const error = useAppSelector(selectPostsError);
  const currentKeyword = useAppSelector(selectCurrentKeyword); // 最後に生成試行したキーワード

  const {
    isLoading: xPostLoading,
    isError: xPostError,
    process,
  } = useAppSelector(selectXPostsStatus);

  // loading状態を boolean で扱うための変数
  const isLoading = loadingStatus === 'pending';

  // --- 副作用: Thunk完了時の通知 ---
  useEffect(() => {
    // ローディングが完了し (succeeded)、エラーがない場合
    if (loadingStatus === 'succeeded' && currentKeyword === keyword && posts.length > 0) {
      showNotification({
        title: t('xPosts.generator.generated'),
        message: t('xPosts.generator.generatedMessage', { count: posts.length }),
        color: 'green',
      });
    }
    // ローディングが完了し (succeeded)、結果が0件だった場合
    else if (loadingStatus === 'succeeded' && currentKeyword === keyword && posts.length === 0) {
      showNotification({
        title: t('xPosts.generator.noResults'),
        message: t('xPosts.generator.noResultsMessage', { keyword }),
        color: 'orange',
      });
    }
    // ローディングが失敗した場合 (failed)
    else if (loadingStatus === 'failed' && error) {
      showNotification({
        title: t('common.error'),
        message: t('xPosts.generator.error', { error }),
        color: 'red',
      });
    }
    // `keyword` の変更で通知が出ないように `currentKeyword` と比較
  }, [loadingStatus, error, posts.length, keyword, currentKeyword, t]); // 依存配列に注意

  // --- 副作用: ポストインポート通知 ---
  useEffect(() => {
    if (process === 'createMultiple') {
      if (xPostLoading) {
        showNotification({
          id: 'import',
          loading: true,
          title: t('xPosts.generator.importing'),
          message: t('xPosts.generator.importingMessage'),
        });
      } else {
        // インポート完了
        const importCount = posts.filter((post) => post.adopted).length;
        if (!xPostError && importCount > 0) {
          showNotification({
            id: 'import',
            title: t('xPosts.generator.imported'),
            message: t('xPosts.generator.importedMessage', { count: importCount }),
            color: 'green',
          });
        }
        // インポート失敗
        else if (xPostError) {
          showNotification({
            id: 'import',
            title: t('xPosts.generator.importError'),
            message: t('xPosts.generator.importFailed'),
            color: 'red',
          });
        }
      }
    }
  }, [xPostLoading, xPostError, process, posts, t]);

  // --- イベントハンドラー ---
  const importGeneratedPosts = () => {
    const selectedPosts = posts.filter((post) => post.adopted);
    const importData: XPostDataType[] = selectedPosts.map((post) => ({
      id: '',
      contents: post.text,
      mediaUrls: '',
      postSchedule: null,
      postTo: xAccountId,
      inReplyToInternal: '',
    }));
    dispatch(createMultiplePost({ xAccountId, posts: importData }));
  };

  // ポスト生成ボタンクリック時の処理
  const handleGeneratePosts = () => {
    if (!keyword.trim()) {
      showNotification({
        title: t('admin.messages.inputError'),
        message: t('xPosts.generator.enterKeyword'),
        color: 'yellow',
      });
      return;
    }
    // ThunkをディスパッチしてAPI呼び出しを開始
    dispatch(generatePostsThunk(keyword));
  };

  // ポストのテキスト変更ハンドラー
  const handlePostTextChange = (id: string, newText: string) => {
    dispatch(updatePostText({ id, newText }));
  };

  // ポストの採用状態変更ハンドラー
  const handlePostAdoptionChange = (id: string, checked: boolean) => {
    dispatch(setPostAdoption({ id, adopted: checked }));
  };

  // エラーアラートを閉じるハンドラー
  const handleErrorAlertClose = () => {
    dispatch(clearError());
  };

  // コンポーネントがアンマウントされる時などに状態をリセット（任意）
  useEffect(() => {
    // コンポーネントのマウント時に初期化したい場合など
    dispatch(resetPostsState()); // 必要なら

    // アンマウント時に状態をクリア
    return () => {
      dispatch(resetPostsState()); // 画面遷移時にクリアする場合など
    };
  }, [dispatch]);

  return (
    <Modal size="lg" opened={opened} onClose={onClose}>
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {' '}
          <Title order={2} ta="center">
            {' '}
            {/* Mantine v7以降は ta="center" */}
            {t('xPosts.generator.title')}
          </Title>
          <KeywordPanel
            keyword={keyword}
            setKeyword={setKeyword} // ローカルステートを更新
            onGenerate={handleGeneratePosts} // Redux Thunkをディスパッチ
            loading={isLoading} // Reduxのローディング状態を使用
          />
          {/* ローディング表示 */}
          {isLoading && (
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader variant="dots" size="xl" />
            </Box>
          )}
          {/* エラー表示 */}
          {loadingStatus === 'failed' && error && (
            <Alert title={t('xPosts.generator.errorTitle')} color="red" withCloseButton onClose={handleErrorAlertClose}>
              {error}
            </Alert>
          )}
          {/* ポスト表示エリア */}
          {/* ローディング中でなく、成功しており、ポストが存在する場合のみ表示 */}
          {loadingStatus === 'succeeded' && posts.length > 0 && (
            <>
              <Divider my="sm" />
              <PostDisplay
                posts={posts} // Reduxから取得したポスト
                onTextChange={handlePostTextChange} // Redux Actionをディスパッチ
                onAdoptionChange={handlePostAdoptionChange} // Redux Actionをディスパッチ
                onImport={importGeneratedPosts} // インポートボタンのハンドラー
              />
            </>
          )}
          {/* ローディング中でなく、成功したが、ポストが0件の場合の表示 (任意) */}
          {loadingStatus === 'succeeded' && posts.length === 0 && !error && (
            <Alert title={t('xPosts.generator.noResults')} color="blue">
              {t('xPosts.generator.noResultsTryAnother', { keyword: currentKeyword })}
            </Alert>
          )}
        </Stack>
      </Container>
    </Modal>
  );
};

export default PostsGenerator;
