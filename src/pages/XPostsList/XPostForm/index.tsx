import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import twitter from '@ambassify/twitter-text';
import { IconAlertCircle, IconBrandGoogleDrive, IconCheck } from '@tabler/icons-react';
import { EmojiClickData } from 'emoji-picker-react';
import emojiRegex from 'emoji-regex';
import { getAuth } from 'firebase/auth';
import { MRT_Row, MRT_TableInstance } from 'mantine-react-table';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  LoadingOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import Mp4Image from '@/assets/images/mp4image.jpg';
import CircularWithLabel from '@/components/CircularWithLabel';
import EmojiPicker, { EmojiPickerRef } from '@/components/EmojiPicker';
import ImageListHorizontalScrolable from '@/components/ImageListHorizontalScrolable';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { RootState } from '@/store';
// import { selectApiError, selectApiStatus } from '@/store/reducers/apiControllerSlice';
import { linkAndGetGoogleToken } from '@/store/reducers/googleAccessTokenSlice';
import {
  clearXPostsErrors,
  createXPost,
  selectXPostsStatus,
  updateXPost,
} from '@/store/reducers/xPostsSlice';
import { MediaDataType, XPostDataType } from '@/types/xAccounts';
import { deleteBlobFromCache, saveBlobToCache } from '@/utils/db';
import { performUploadWorkflow } from '@/utils/googleDrive/uploadManager';
// 既存のimport文
import { BlobUrlManager, fetchAndCacheBlob, loadImage } from '@/utils/mediaCache';
import FileInput from './FileInput';

// (MediaDataType, XPostFormProps, xPostFormDefaultValue は前回の修正と同様)
interface CachedMediaDataType extends MediaDataType {
  isLoading?: boolean;
  error?: string | null;
  // isCached?: boolean; // (任意)
}

interface XPostFormProps {
  xAccountId: string;
  table: MRT_TableInstance<XPostDataType>;
  row: MRT_Row<XPostDataType>;
  xPostData: XPostDataType;
  feedBack: ({ operation, text }: { operation: string; text: string }) => void;
}

// Google API の型定義 (必要に応じて)
declare global {
  interface Window {
    gapi: any;
    google: any;
    googlePickerLoaded?: boolean;
  }
}

export const xPostFormDefaultValue: XPostDataType = {
  id: '',
  contents: '',
  postTo: '',
  inReplyToInternal: '',
  mediaUrls: '',
  postSchedule: '',
};

type PostType = 'regular' | 'quote' | 'reply' | 'repost';

const XPostForm: React.FC<XPostFormProps> = (props) => {
  const { t } = useTranslation();
  // dayjs プラグインの初期化
  dayjs.extend(utc);
  dayjs.extend(timezone);

  const { xAccountId, table, xPostData, feedBack } = props;

  const [text, setText] = useState('');
  const [contentError, setContentError] = useState(false);
  const [pics, setPics] = useState<CachedMediaDataType[]>([]);
  const [scheduledPostTime, setScheduledPostTime] = useState<Date | null>(null);
  const [postType, setPostType] = useState<PostType>('regular');
  const [quoteOrReplyId, setQuoteOrReplyId] = useState<string>('');
  const textInputLabel =
    postType === 'reply'
      ? t('xPosts.form.replyUrl')
      : postType === 'quote'
        ? t('xPosts.form.quotePost')
        : postType === 'repost'
          ? t('xPosts.form.repostUrl')
          : '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReauthButton, setShowReauthButton] = useState(false);
  const [_cancelUpload, setCancelUpload] = useState(false);
  const [weightedLength, setWeightedLength] = useState(0);
  const [_selectedHashTags, setSelectedHashTags] = useState<string[]>([]);

  // for google drive picker
  const [isPickerApiLoaded, setIsPickerApiLoaded] = useState(window.googlePickerLoaded || false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID; // .env から取得
  const googleDeveloperKey = import.meta.env.VITE_GOOGLE_API_KEY; // .env から取得

  // fileIdをキーとするRecordに
  const blobUrlsRef = useRef<Record<string, string>>({});
  const emojiPickerRef = useRef<EmojiPickerRef | null>(null);
  const isMounted = useRef(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Select コンポーネント用のデータ
  const postTypeOptions = [
    { value: 'regular', label: t('xPosts.form.regular') },
    { value: 'reply', label: t('xPosts.reply') },
    { value: 'quote', label: t('xPosts.form.quotePost') },
    // { value: 'repost', label: 'リポスト' }, // リポストは有料プランのみ
  ];

  const dispatch = useAppDispatch();
  // const apiStatus = useAppSelector(selectApiStatus);
  // const apiError = useAppSelector(selectApiError);
  const {
    isLoading: isPostLoading,
    isError: isPostError,
    errorMessage: postErrorMessage,
    process,
  } = useAppSelector(selectXPostsStatus);
  const { isAuthLoading: isTokenLoading, googleAccessToken } = useAppSelector(
    (state: RootState) => state.googleAccessTokenState
  );
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return null; // ユーザーがサインインしていない場合は何も表示しない
  }

  // BlobURLマネージャーのインスタンスを作成
  const blobUrlManager = useMemo(() => new BlobUrlManager(), []);
  // コンポーネントのアンマウント時にBlobURLを解放
  useEffect(() => {
    return () => {
      blobUrlManager.releaseAll();
    };
  }, [blobUrlManager]);

  // ★ Blob URL 解放処理 ★
  // revokeAllBlobUrlsを置き換え
  const revokeAllBlobUrls = useCallback(() => {
    blobUrlManager.releaseAll();
    // pics state の imgUrl もクリア (表示を更新するため)
    setPics((prevPics) => prevPics.map((p) => ({ ...p, imgUrl: '' })));
  }, [blobUrlManager]);

  const countEmoji = useCallback((text: string): number => {
    const regex = emojiRegex();
    const emojis = text.match(regex) || [];
    return emojis.length;
  }, []);

  // Picker API のロード状態を監視
  useEffect(() => {
    const handlePickerLoad = () => {
      setIsPickerApiLoaded(true);
    };
    if (window.googlePickerLoaded) {
      setIsPickerApiLoaded(true);
    } else {
      // イベントリスナーでロード完了を待つ
      window.addEventListener('google-picker-loaded', handlePickerLoad);
    }
    return () => {
      window.removeEventListener('google-picker-loaded', handlePickerLoad);
    };
  }, []);

  // Xポストのステータスが変化したときの処理
  useEffect(() => {
    if (isPostError) {
      setIsSubmitting(false);
      setErrorMessage(postErrorMessage);
      notifications.show({
        title: t('common.error'),
        message: postErrorMessage,
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } else if (!isPostLoading && (process === 'addNew' || process === 'update') && isSubmitting) {
      setIsSubmitting(false);
      setCancelUpload(false);
      console.log('投稿処理完了:', process);
      // フィードバックと画面遷移を処理
      feedBack({ operation: process, text: `${text.substring(0, 30)}...` });

      // 投稿の作成または更新が成功した場合、テーブルの表示状態をリセット
      if (xPostData.id === '') {
        table.setCreatingRow(null);
      } else {
        table.setEditingRow(null);
      }

      // メモリリークを防ぐためにリソースをクリーンアップ
      pics.forEach((pic) => {
        if (pic.imgUrl && pic.imgUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pic.imgUrl);
        }
      });
    }
  }, [
    isPostLoading,
    isPostError,
    process,
    isSubmitting,
    feedBack,
    table,
    xPostData.id,
    postErrorMessage,
    revokeAllBlobUrls,
  ]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      pics.forEach((pic) => {
        if (pic.imgUrl && pic.imgUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pic.imgUrl);
        }
      });
    };
  }, []);

  const handleLoadImage = useCallback(
    async (picData: CachedMediaDataType, currentToken: string | null) => {
      const { fileId, mimeType } = picData;

      return loadImage(fileId, currentToken, mimeType, {
        onLoadingStart: (fileId) => {
          setPics((prevPics) =>
            prevPics.map((p) => (p.fileId === fileId ? { ...p, isLoading: true, error: null } : p))
          );
        },
        onSuccess: (fileId, objectUrl) => {
          if (isMounted.current) {
            if (objectUrl !== Mp4Image) {
              blobUrlManager.addUrl(fileId, objectUrl);
            }
            setPics((prevPics) =>
              prevPics.map((p) =>
                p.fileId === fileId ? { ...p, imgUrl: objectUrl, isLoading: false, error: null } : p
              )
            );
          } else if (objectUrl !== Mp4Image) {
            URL.revokeObjectURL(objectUrl);
          }
        },
        onError: (fileId, error) => {
          if (isMounted.current) {
            console.error(`Error loading image ${fileId}:`, error); // エラーオブジェクト全体をコンソールに出力
            let detailedErrorMessage = t('xPosts.form.unknownError');
            if (error instanceof Error) {
              detailedErrorMessage = error.message;
            } else if (typeof error === 'string') {
              detailedErrorMessage = error;
            }
            // Google APIからのエラーの場合、より詳細な情報が含まれていることがある
            // (例: error.result.error.message など。実際の構造に合わせて調整が必要)

            setPics((prevPics) =>
              prevPics.map((p) =>
                p.fileId === fileId ? { ...p, isLoading: false, error: detailedErrorMessage } : p
              )
            );
            notifications.show({
              title: t('xPosts.form.mediaLoadError'),
              message: t('xPosts.form.mediaLoadFailed', { fileId, error: detailedErrorMessage }),
              color: 'red',
            });
          }
        },
      });
    },
    [blobUrlManager, t]
  );

  // 初期データ読み込みと画像ロードトリガー
  useEffect(() => {
    setText(xPostData.contents || '');
    if (xPostData.postSchedule) {
      setScheduledPostTime(new Date(xPostData.postSchedule));
    } else {
      setScheduledPostTime(null);
    }

    if (xPostData.inReplyToOnX) {
      setQuoteOrReplyId(xPostData.inReplyToOnX);
      setPostType('reply');
    }

    if (xPostData.quoteId) {
      setQuoteOrReplyId(xPostData.quoteId);
      setPostType('quote');
    }

    setPics([]);
    revokeAllBlobUrls();

    const currentToken = googleAccessToken; // 現在のトークン

    const loadInitialPics = async (token: string | null) => {
      let initialPics: CachedMediaDataType[] = [];
      if (xPostData.mediaUrls) {
        try {
          const mediaItems = JSON.parse(xPostData.mediaUrls as string);
          if (Array.isArray(mediaItems) && mediaItems.length > 0) {
            initialPics = mediaItems.map(
              (item): CachedMediaDataType => ({
                file: null,
                fileName: item.fileName || item.filename || '',
                fileId: item.fileId || '',
                mimeType: item.mimeType || '',
                imgUrl: '', // 初期は空
                isLoading: !!item.fileId, // fileId があればロード開始フラグ
                error: null,
              })
            );
          }
        } catch (error) {
          console.error('Error parsing media items:', error);
        }
      }

      if (isMounted.current) {
        setPics(initialPics); // まずメタデータで state を更新
        // 各画像のロードを開始
        initialPics.forEach((pic) => {
          if (pic.fileId) {
            handleLoadImage(pic, token); // 修正: handleLoadImage を使用
          }
        });
      }
    };

    // トークンがあればすぐにロード開始、なければ取得を待つ（取得後に再度この Effect が動く）
    loadInitialPics(currentToken);

    if (xPostData.contents) {
      /* ... テキスト長計算 ... */
      setWeightedLength(twitter.parseTweet(xPostData.contents).weightedLength);
    }
  }, [xPostData, countEmoji, handleLoadImage, googleAccessToken, revokeAllBlobUrls]); // ★ loadImage, googleAccessToken を依存配列に追加

  const insertAtPos = useCallback(
    (emojiData: EmojiClickData) => {
      const taRef = textAreaRef.current;
      if (taRef) {
        const startPos = taRef.selectionStart;
        const endPos = taRef.selectionEnd;
        const newText =
          taRef.value.substring(0, startPos) +
          emojiData.emoji +
          taRef.value.substring(endPos, taRef.value.length);
        setText(newText);
        const response = twitter.parseTweet(newText);
        const emojiCount = countEmoji(newText);
        setWeightedLength(response.weightedLength + emojiCount);
      }
      emojiPickerRef.current?.setShowEmoji(false);
    },
    [countEmoji]
  );

  // const insertAtEnd = useCallback(
  //   (selectedOptions: string[]) => {
  //     const taRef = textAreaRef.current;
  //     if (taRef) {
  //       let text = taRef.value;
  //       for (let i = 0; i < selectedHashTags.length; i++) {
  //         text = text.replace(selectedHashTags[i], '');
  //         text = text.replace('  ', ' ');
  //       }
  //       setSelectedHashTags(selectedOptions);
  //       const newPost = `${text} ${selectedOptions.join(' ')}`;
  //       setText(newPost);
  //       const response = parseTweet(newPost);
  //       const emojiCount = countEmoji(newPost);
  //       setWeightedLength(response.weightedLength + emojiCount);
  //     }
  //   },
  //   [selectedHashTags, countEmoji]
  // );

  // addImage: ローカルファイル追加時の処理 (Blob URL 生成、IndexedDB には保存しない)
  // addImage: 動画ファイルの場合の処理を追加
  const addImage = useCallback((newPicData: MediaDataType) => {
    const file = newPicData.file;
    if (file) {
      let imgUrl = '';
      const isVideo = file.type.startsWith('video/');
      const mimeType = file.type;
      let tempKey: string | null = null; // Blob URL 解放用のキー

      if (isVideo) {
        imgUrl = Mp4Image; // 動画ならデフォルト画像
      } else if (file.type.startsWith('image/')) {
        imgUrl = URL.createObjectURL(file); // 画像なら Blob URL
        tempKey = `local_${newPicData.fileName}_${Date.now()}`;
        blobUrlsRef.current[tempKey] = imgUrl; // Ref に保存
      } else {
        notifications.show({
          message: t('xPosts.form.selectMediaFile'),
          color: 'orange',
        });
        return; // 対応外ファイルなら追加しない
      }

      const newPic: CachedMediaDataType = {
        ...newPicData,
        fileId: '', // ローカルファイルなので fileId は空
        imgUrl,
        mimeType, // ★ mimeType をセット ★
        isLoading: false,
        error: null,
      };
      setPics((oldPics) => [...oldPics, newPic]);
    }
  }, [t]);

  // removeImage: Blob URL 解放処理
  const removeImage = useCallback((targetFileName: string) => {
    setPics((oldPics) => {
      const picToRemove = oldPics.find((pic) => pic.fileName === targetFileName);
      // 対応する Blob URL を Ref から見つけて解放
      let keyToRemove: string | null = null;
      if (picToRemove?.imgUrl) {
        const entry = Object.entries(blobUrlsRef.current).find(
          ([url]) => url === picToRemove.imgUrl
        );
        if (entry) {
          keyToRemove = entry[0];
          URL.revokeObjectURL(picToRemove.imgUrl);
          delete blobUrlsRef.current[keyToRemove]; // Ref からも削除
        }
      }
      // (任意) IndexedDB からも削除する場合
      if (picToRemove?.fileId) {
        deleteBlobFromCache(picToRemove.fileId);
      }
      return oldPics.filter((pic) => pic.fileName !== targetFileName);
    });
  }, []);

  const textParse = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setText(e.currentTarget.value);
      if (e.currentTarget.value.length > 0) {
        setContentError(false);
      }
      const response = twitter.parseTweet(e.currentTarget.value);
      const emojiCount = countEmoji(e.currentTarget.value);
      setWeightedLength(response.weightedLength + emojiCount);
    },
    [countEmoji]
  );

  const handleSubmit = async () => {
    if (text === '' && postType !== 'repost') {
      setContentError(true);
      setErrorMessage(t('xPosts.form.contentRequired'));
      return;
    }

    if (postType !== 'regular') {
      const errorMsgTitle =
        postType === 'reply'
          ? t('xPosts.form.replyUrl')
          : postType === 'quote'
            ? t('xPosts.form.quotePost')
            : postType === 'repost'
              ? t('xPosts.form.repostUrl')
              : '';
      const regex = /^https:\/\/x\.com\/[a-zA-Z0-9_]{1,15}\/status\/(\d+)$/;

      const isEditingReply = postType === 'reply' && (xPostData?.id?.length ?? 0) > 0;
      const isNumeric = /^\d+$/.test(quoteOrReplyId);
      const isUrlFormat = regex.test(quoteOrReplyId);

      if (quoteOrReplyId === '') {
        setErrorMessage(t('xPosts.form.targetRequired', { label: errorMsgTitle }));
        setIsSubmitting(false); // ローディング解除
        return; // Stop submission
      }

      // 編集中のリプライで、かつ数字のみの場合 -> OK
      if (isEditingReply && isNumeric) {
        // Validation passes for editing reply with numeric ID
      }
      // URL形式の場合 -> OK (新規・編集問わず)
      else if (isUrlFormat) {
        // Validation passes for URL format
      }
      // 上記以外の場合 -> NG
      else {
        let specificErrorMessage = t('xPosts.form.invalidTarget', { label: errorMsgTitle });
        if (isEditingReply) {
          specificErrorMessage += t('xPosts.form.urlOrIdHint');
        } else {
          specificErrorMessage += t('xPosts.form.urlHint');
        }
        console.log('Validation failed for:', quoteOrReplyId, 'isEditingReply:', isEditingReply); // Add log for debugging
        setErrorMessage(specificErrorMessage);
        setIsSubmitting(false); // ローディング解除
        return; // Stop submission
      }
      // If we reach here, quoteOrReplyId is valid for reply/quote
      console.log('quoteOrReplyId validation passed:', quoteOrReplyId);
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setShowReauthButton(false);
    let finalMediaData: CachedMediaDataType[] = [];
    try {
      // 画像がある場合、アップロード
      if (pics.length > 0) {
        // すでにアップロード済みの画像（fileIdがある）とそうでないものを分ける
        const uploadTargets = pics.filter((pic) => !pic.fileId && pic.file);
        const existingMedia = pics.filter((pic) => pic.fileId);
        // const postMedia: CachedMediaDataType[] = [];

        finalMediaData = [...existingMedia]; // まずは既存のメディアをセット
        if (uploadTargets.length > 0) {
          let currentToken = googleAccessToken;
          // 1. 実行前にトークンを確認・取得
          if (!currentToken) {
            console.log('No initial token, attempting to get one...');
            const resultAction = await dispatch(linkAndGetGoogleToken());
            if (linkAndGetGoogleToken.fulfilled.match(resultAction)) {
              currentToken = resultAction.payload.accessToken;
            } else {
              setErrorMessage(resultAction.payload?.message ?? t('xPosts.form.googleAuthRequired'));
              setShowReauthButton(true); // 失敗したら再認証ボタン表示
              setIsSubmitting(false); // ローディング解除
              return; // 中断
            }
          }

          if (!currentToken) {
            // 再度チェック
            setErrorMessage(t('xPosts.form.googleTokenFailed'));
            setShowReauthButton(true);
            setIsSubmitting(false);
            return;
          }
          const successfulUploads: CachedMediaDataType[] = [];
          let needsReauth = false;
          // 2. メディアをアップロード
          for (const pic of uploadTargets) {
            if (pic.file) {
              const notificationId = notifications.show({
                title: t('xPosts.form.uploading', { fileName: pic.fileName }),
                message: t('xPosts.form.pleaseWait'),
                loading: true,
                autoClose: false,
              });
              const result = await performUploadWorkflow({
                selectedFile: pic.file,
                user,
                googleAccessToken: currentToken,
                dispatch,
              });
              if (result.success && result.uploadData) {
                notifications.update({
                  id: notificationId,
                  title: t('xPosts.form.uploadComplete'),
                  message: result.message,
                  color: 'green',
                  icon: <IconCheck />,
                  autoClose: 5000,
                });
                // アップロード成功
                successfulUploads.push({
                  file: null,
                  fileId: result.uploadData.fileId,
                  fileName: result.uploadData.fileName,
                  mimeType: result.uploadData.mimeType,
                  imgUrl: result.uploadData.imageUrl ?? '',
                });
                // ★★★ アップロード成功後、すぐにキャッシュ ★★★
                if (pic.file) {
                  // 元のファイル Blob を使う
                  await saveBlobToCache(result.uploadData.fileId, pic.file);
                } else {
                  // もし pic.file がない場合 (理論上ここには来ないはずだが)
                  fetchAndCacheBlob(result.uploadData.fileId, currentToken); // Driveから再取得してキャッシュ
                }
                // ★★★★★★★★★★★★★★★★★★★★★★★★
              } else {
                notifications.update({
                  id: notificationId,
                  title: t('xPosts.form.uploadFailed'),
                  message: result.message,
                  color: 'red',
                  icon: <IconAlertCircle />,
                });
                setErrorMessage(result.message);
                if (result.needsReauth) {
                  // 再認証が必要な場合
                  needsReauth = true;
                  break;
                }
              }
            }
          }

          if (needsReauth) {
            setShowReauthButton(true);
            setIsSubmitting(false);
            // 処理中断
            return;
          }
          // 3. アップロード成功したメディアを追加
          finalMediaData = [...existingMedia, ...successfulUploads];
        }
      }

      // replyId を抽出 (postTypeが'reply'の場合のみ)
      let replyId = '';
      if (postType === 'reply' || (postType === 'repost' && quoteOrReplyId)) {
        const match = quoteOrReplyId.match(/\/status\/(\d+)$/);
        if (match && match[1]) {
          replyId = match[1];
        }
      }

      const postText = postType === 'repost' ? t('xPosts.form.repostPlaceholder') : text;
      // 新しいポストデータを作成
      const newPost: XPostDataType = {
        id: xPostData.id || '',
        contents: postText,
        mediaUrls: finalMediaData.length > 0 ? JSON.stringify(finalMediaData) : '',
        // ローカルタイムゾーン情報を保持した形式で保存
        postSchedule: scheduledPostTime
          ? dayjs(scheduledPostTime).format('YYYY-MM-DDTHH:mm:ssZ')
          : null,
        postTo: xAccountId || '',
        inReplyToInternal: xPostData.inReplyToInternal || '',
        inReplyToOnX: postType === 'reply' ? replyId : '',
        quoteId: postType === 'quote' ? quoteOrReplyId : '',
        repostTargetId: postType === 'repost' ? replyId : '',
      };

      // 新規作成または更新
      if (!xPostData.id) {
        await dispatch(createXPost({ xAccountId, xPost: newPost }));
      } else {
        await dispatch(updateXPost({ xAccountId, xPost: newPost }));
      }
    } catch (error) {
      console.error('投稿処理エラー:', error);
      setIsSubmitting(false);
      setErrorMessage(t('xPosts.processingError'));
    }
  };

  const handleCancel = useCallback(() => {
    if (isPostError) {
      dispatch(clearXPostsErrors());
    }
    pics.forEach((pic) => {
      if (pic.imgUrl && pic.imgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pic.imgUrl);
      }
    });
    if (xPostData.id === '') {
      table.setCreatingRow(null);
    } else {
      table.setEditingRow(null);
    }
  }, [isPostError, pics, xPostData.id, dispatch, table]);

  const clearErrors = useCallback(() => {
    setErrorMessage(null);
    dispatch(clearXPostsErrors());
  }, [dispatch]);

  const handleReset = useCallback(() => {
    setText('');
    setContentError(false);
    pics.forEach((pic) => {
      if (pic.imgUrl && pic.imgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pic.imgUrl);
      }
    });
    setPics([]);
    setScheduledPostTime(null);
    setSelectedHashTags([]);
    setWeightedLength(0);
    clearErrors();
  }, [pics, clearErrors]);

  const handleReAuthClick = useCallback(async () => {
    const resultAction = await dispatch(linkAndGetGoogleToken());
    if (linkAndGetGoogleToken.rejected.match(resultAction)) {
      setErrorMessage(t('xPosts.form.googleAuthFailed', { error: String(resultAction.payload ?? '') }));
    } else {
      notifications.show({
        title: t('common.success'),
        message: t('xPosts.form.googlePermissionUpdated'),
        color: 'green',
        icon: <IconCheck />,
      });
    }
  }, [dispatch, t]);

  // const handleCancelUpload = useCallback(() => {
  //   setCancelUpload(true);
  // }, []);

  // Google Picker を開く処理
  const handleOpenPicker = useCallback(async () => {
    console.log('[handleOpenPicker] Initial googleAccessToken from store:', googleAccessToken);
    if (!isPickerApiLoaded) {
      notifications.show({
        title: t('xPosts.form.preparing'),
        message: t('xPosts.form.waitingForPicker'),
        color: 'blue',
      });
      return;
    }

    let currentToken = googleAccessToken;

    // トークンがなければ取得試行
    if (!currentToken) {
      const resultAction = await dispatch(linkAndGetGoogleToken());
      if (linkAndGetGoogleToken.fulfilled.match(resultAction)) {
        currentToken = resultAction.payload.accessToken;
        console.log('[handleOpenPicker] Token obtained/refreshed:', currentToken);
      } else {
        notifications.show({
          title: t('xPosts.form.authError'),

          message: resultAction.payload?.message ?? t('xPosts.form.googleConnectionRequired'),
          color: 'red',
        });
        // 必要なら再認証ボタン表示などの処理
        setShowReauthButton(true);
        return;
      }
    }

    if (!currentToken) {
      console.log('[handleOpenPicker] Token is still null after attempt.');
      notifications.show({
        title: t('common.error'),
        message: t('xPosts.form.googleTokenFailed'),
        color: 'red',
      });
      setShowReauthButton(true);
      return;
    }

    console.log('[handleOpenPicker] Using token for Picker:', currentToken);

    // Picker でファイルが選択されたときのコールバックをこのスコープ内で定義
    // これにより、この handleOpenPicker 呼び出し時の currentToken をキャプチャする
    const pickerCallbackForThisInstance = (data: any) => {
      console.log('[pickerCallbackForThisInstance] Callback triggered. Using token:', currentToken);
      if (data.action === window.google.picker.Action.PICKED) {
        const docs = data.docs;
        if (docs && Array.isArray(docs) && docs.length > 0) {
          const newPicsFromPicker: CachedMediaDataType[] = [];
          docs.forEach((doc: any, index: number) => {
            console.log('Selected Google Drive file:', doc);
            if (!doc.id) {
              console.error('Google Picker: fileId is missing in picked document.', doc);
              notifications.show({
                title: t('common.error'),
                message: t('xPosts.form.driveFileMissingId', { fileName: doc.name || t('xPosts.form.unknownFile') }),
                color: 'red',
              });
              return;
            }
            console.log(
              `Selected Google Drive file [${index}] (full details):`,
              JSON.stringify(doc, null, 2)
            );

            const fileId = doc.id;
            const fileName = doc.name;
            const mimeType = doc.mimeType;

            const newPicData: CachedMediaDataType = {
              file: null,
              fileId,
              fileName,
              mimeType,
              imgUrl: null,
              isLoading: true,
              error: null,
            };
            newPicsFromPicker.push(newPicData);
            handleLoadImage(newPicData, currentToken); // キャプチャしたcurrentTokenを使用
          });

          if (pics.length + newPicsFromPicker.length > 4) {
            notifications.show({
              title: t('xPosts.form.limitExceeded'),
              message: t('xPosts.form.mediaLimit'),
              color: 'orange',
            });
            const remainingSlots = 4 - pics.length;
            setPics((oldPics) => [...oldPics, ...newPicsFromPicker.slice(0, remainingSlots)]);
          } else {
            setPics((oldPics) => [...oldPics, ...newPicsFromPicker]);
          }
        }
      } else if (data.action === window.google.picker.Action.CANCEL) {
        console.log('Google Picker was cancelled.');
      }
    };

    // Picker の設定と表示
    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    // 画像と動画のみ表示・選択可能にする
    view.setMimeTypes('image/png,image/jpeg,image/jpg,image/gif,video/mp4,video/quicktime'); // 必要に応じてMIMEタイプを追加

    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.NAV_HIDDEN) // ナビゲーションを隠す (任意)
      .setAppId(googleClientId) // App ID (Client ID) を設定
      .setOAuthToken(currentToken) // OAuth トークンを設定
      .addView(view)
      // .addView(new window.google.picker.DocsUploadView()) // アップロードビューも追加する場合
      .setDeveloperKey(googleDeveloperKey) // API キーを設定
      .setCallback(pickerCallbackForThisInstance) // このインスタンス用のコールバックを設定
      .build();
    picker.setVisible(true);
  }, [
    isPickerApiLoaded,
    googleAccessToken,
    dispatch,
    googleClientId,
    googleDeveloperKey,
    handleLoadImage,
    pics.length,
    setPics,
    notifications,
    t,
  ]);

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder>
          <LoadingOverlay visible={isSubmitting} />
          {errorMessage && (
            <Alert
              color="red"
              title={t('common.error')}
              withCloseButton={!showReauthButton}
              onClose={clearErrors}
              mb="md"
            >
              {errorMessage}
              {showReauthButton && (
                <Button
                  mt="sm"
                  variant="outline"
                  color="red"
                  onClick={handleReAuthClick}
                  loading={isTokenLoading}
                >
                  {isTokenLoading ? t('xPosts.form.authenticating') : t('xPosts.form.googleReauth')}
                </Button>
              )}
            </Alert>
          )}
          <Card.Section p="12px 24px 12px 24px">
            <Stack>
              <Textarea
                error={contentError ? t('xPosts.form.contentRequired') : null}
                id="x-post-form-textarea"
                placeholder={t('xPosts.form.placeholder')}
                autosize
                minRows={5}
                ref={textAreaRef}
                value={text}
                onChange={textParse}
              />
              {pics.length > 0 && (
                <ImageListHorizontalScrolable pics={pics} removeImage={removeImage} />
              )}
              <Group gap="md">
                <FileInput onChange={addImage} disabled={pics.length > 3} />
                {/* Google Drive ボタン */}
                <Tooltip label={t('xPosts.form.selectFromDrive')}>
                  <ActionIcon
                    size={36}
                    variant="filled"
                    onClick={handleOpenPicker}
                    disabled={!isPickerApiLoaded || pics.length >= 4} // APIロード前や上限到達時は無効化
                    loading={!isPickerApiLoaded && !window.googlePickerLoaded} // ロード中はローディング表示
                  >
                    <IconBrandGoogleDrive size={48} />
                  </ActionIcon>
                </Tooltip>
                <EmojiPicker onSelectedEmoji={insertAtPos} ref={emojiPickerRef} />
                <CircularWithLabel value={weightedLength} size={48} />
                <Text c="dimmed" mx="md">
                  {t('xPosts.form.characterCount', { count: weightedLength })}
                </Text>
              </Group>
              <Box>
                <Stack align="center">
                  <Box w="100%">
                    <Select
                      label={t('xPosts.form.postType')} // Select にラベルを追加
                      value={postType}
                      onChange={(value) => {
                        // onChange で string | null が返るため、null チェックと型アサーション
                        if (value) {
                          setPostType(value as PostType);
                        }
                      }}
                      data={postTypeOptions} // Select 用のデータを設定
                      mb="md" // 下マージンを維持
                      allowDeselect={false} // 選択解除を不許可 (任意)
                    />

                    {/* postType が 'regular' でない場合に TextInput を表示 */}
                    {postType !== 'regular' && (
                      <Stack gap="xs">
                        {postType === 'reply' && (
                          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                            {t('xPosts.form.replyRestriction')}
                          </Alert>
                        )}
                        <TextInput
                          label={textInputLabel} // 動的なラベルを設定
                          value={quoteOrReplyId}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setQuoteOrReplyId(event.currentTarget.value)
                          }
                          // プレースホルダーも動的に変更する例 (任意)
                          placeholder={
                            postType === 'reply'
                              ? t('xPosts.form.replyUrlPlaceholder')
                              : postType === 'quote'
                                ? t('xPosts.form.quoteUrlPlaceholder')
                                : ''
                          }
                          required // リプライや引用の場合は必須にする (任意)
                        />
                      </Stack>
                    )}
                  </Box>
                  <DateTimePicker
                    label={t('xPosts.form.schedule')}
                    value={scheduledPostTime}
                    onChange={setScheduledPostTime}
                    minDate={dayjs().add(1, 'hour').toDate()}
                    clearable
                    w="100%"
                  />
                </Stack>
              </Box>
            </Stack>
          </Card.Section>
          <Divider />
          <Card.Section>
            <Group justify="end" gap="xs" px="md" py="xs">
              <Button variant="outline" color="yellow" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button variant="outline" color="gray" onClick={handleReset}>
                {t('xPosts.form.reset')}
              </Button>
              <Button
                variant="outline"
                color="blue"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={(postType !== 'repost' && text.trim() === '') || weightedLength > 280}
              >
                {t('common.save')}
              </Button>
            </Group>
          </Card.Section>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default React.memo(XPostForm);
