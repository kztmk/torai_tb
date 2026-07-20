import { useEffect, useState } from 'react';
import { IconBrandX, IconX } from '@tabler/icons-react';
import { Button, Container, Group, Image, Modal, Text, Tooltip } from '@mantine/core';
import { VerticalTimeline, VerticalTimelineElement } from '@/components/VerticalTimeline';
import { MediaDataType, XPostDataType } from '@/types/xAccounts';
import { getBlobFromCache } from '@/utils/db';
import { useTranslation } from 'react-i18next';

interface ThreadPostsProps {
  open: boolean;
  onClose: () => void;
  posts: XPostDataType[];
  onConfirm: (threadPosts: XPostDataType[]) => void;
}

const ThreadPosts: React.FC<ThreadPostsProps> = (props) => {
  const { t } = useTranslation();
  const { open, onClose, posts, onConfirm } = props;
  const [xPosts, setXPosts] = useState<XPostDataType[]>([]); // 初期値を空配列に変更
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true); // ローディング状態を追加

  useEffect(() => {
    setIsLoading(true); // ローディング開始
    const sortedPosts = [...posts].sort((a, b) => {
      // 1. postSchedule で比較 (変更なし)
      const scheduleA = a.postSchedule ? new Date(a.postSchedule).getTime() : Infinity;
      const scheduleB = b.postSchedule ? new Date(b.postSchedule).getTime() : Infinity;
      if (scheduleA !== scheduleB) {
        return scheduleA - scheduleB;
      }

      // 2. createdAt で比較 (GASからの値に対応)
      const getCreatedAtMillis = (createdAtValue: XPostDataType['createdAt']): number => {
        if (!createdAtValue) {
          return Infinity; // null/undefined は最後に
        }
        // GASから渡される createdAt (文字列 or 数値) を Date オブジェクトに変換
        try {
          const date = new Date(createdAtValue);
          // 無効な日付の場合は Infinity を返す
          return isNaN(date.getTime()) ? Infinity : date.getTime();
        } catch (e) {
          // Dateコンストラクタがエラーを投げる可能性も考慮
          console.error('Error parsing createdAt:', createdAtValue, e);
          return Infinity;
        }
      };

      const createdAtA = getCreatedAtMillis(a.createdAt);
      const createdAtB = getCreatedAtMillis(b.createdAt);

      return createdAtA - createdAtB;
    });

    setXPosts(sortedPosts);
    setIsLoading(false); // ローディング終了
  }, [posts]);

  useEffect(() => {
    const loadMediaUrls = async () => {
      const urls: Record<string, string> = {};
      for (const post of props.posts) {
        if (post.mediaUrls) {
          const mediaList = JSON.parse(post.mediaUrls);
          for (const media of mediaList) {
            if (media.fileId) {
              const cachedBlob = await getBlobFromCache(media.fileId);
              if (cachedBlob) {
                urls[media.fileId] = URL.createObjectURL(cachedBlob);
              }
            }
          }
        }
      }
      setMediaUrls(urls);
    };

    loadMediaUrls();

    return () => {
      // Cleanup object URLs to prevent memory leaks
      Object.values(mediaUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [props.posts]);

  const handleDeleteClick = (id: string) => {
    setXPosts((prevPosts) => prevPosts.filter((post) => post.id !== id));
  };

  const showMediaNumber = (media: string | undefined) => {
    if (!media) {
      return '';
    }
    const mediaList = JSON.parse(media);
    if (mediaList.length === 0) {
      return '';
    }
    if (mediaList.length > 0) {
      return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span>{t('xPosts.thread.media')}:</span>
          {mediaList.map((image: MediaDataType, index: number) => (
            <Tooltip
              key={index}
              label={
                mediaUrls[image.fileId] ? (
                  <Image
                    src={mediaUrls[image.fileId]}
                    alt={image.fileName || t('xPosts.imageNumber', { count: index + 1 })}
                    width={200}
                  />
                ) : (
                  t('xPosts.thread.loadingImage')
                )
              }
              withArrow
            >
              <span title={image.fileName || t('xPosts.imageNumber', { count: index + 1 })}>🌟</span>
            </Tooltip>
          ))}
        </div>
      );
    }
  };

  useEffect(() => {
    console.log('ThreadPosts received posts:', posts);
    console.log('ThreadPosts xPosts state:', xPosts);
  }, [posts, xPosts]);

  if (isLoading) {
    return <Text>{t('common.loading')}</Text>; // ローディング中の表示
  }

  const handleCancelClick = () => {
    setXPosts([]);
    onClose();
  };

  // スレッド投稿を作成する関数
  const handleCreateThread = () => {
    onConfirm(xPosts);
    setXPosts([]);
    onClose();
  };

  return (
    <Modal
      opened={open}
      onClose={() => onClose()}
      title={t('xPosts.createThread')}
      size="lg" // サイズを一段小さく変更
      styles={{
        content: {
          height: '80vh', // 縦の高さを80%に設定
          borderLeft: '4px solid #9b59b6',
        },
      }}
    >
      <Container size="lg" p="md">
        <Group justify="center" mt="xl" w="100%" gap="md">
          <Button
            variant="outline"
            color="gray"
            onClick={handleCancelClick}
            size="md"
            w={150}
            leftSection={<IconX size={18} />}
            type="button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            size="md"
            w={150}
            leftSection={<IconBrandX size={18} />}
            onClick={handleCreateThread}
          >
            {t('common.create')}
          </Button>
        </Group>
        <VerticalTimeline lineColor="#5474b4">
          {xPosts.map((post) => (
            <VerticalTimelineElement
              id={post.id || ''}
              key={post.id}
              className="vertical-timeline-element--work"
              contentStyle={{ background: 'rgb(235,232,219)', color: '#3d0301' }}
              contentArrowStyle={{ borderRight: '7px solid  #ebe8db' }}
              date={post.postSchedule}
              icon={<IconBrandX />}
              onDelete={() => handleDeleteClick(post.id || '')}
              iconStyle={{ background: '#9b59b6', color: '#fff' }}
            >
              <h3 className="vertical-timeline-element-title">{post.contents}</h3>
              {showMediaNumber(post.mediaUrls)}
            </VerticalTimelineElement>
          ))}
        </VerticalTimeline>
      </Container>
    </Modal>
  );
};

export default ThreadPosts;
