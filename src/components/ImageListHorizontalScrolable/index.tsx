// ImageListHorizontalScrolable.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
} from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { ActionIcon, Box, Button, Group, Image, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/** 画像サムネイル表示用の最小データ型（imgUrl と削除キーの fileName を持つ） */
export type MediaThumbType = {
  file?: File | null;
  fileName: string;
  fileId?: string;
  imgUrl: string | null;
  mimeType?: string;
};

interface ImageListHorizontalScrolableProps {
  pics: MediaThumbType[];
  removeImage: (path: string) => void;
  /** 指定時、各画像に並べ替えボタン（◀ ▶）を表示。dir: -1=前へ / 1=次へ */
  moveImage?: (fileName: string, dir: -1 | 1) => void;
}

/**
 * ImageListHorizontalScrolable component
 *
 * This component displays a horizontally scrollable list of images.
 * Each image in the list has a delete button that can be used to remove the image from the list.
 *
 * Props:
 * - `pics`: An array of objects, where each object represents an image. Each object should have the following properties:
 *   - `imageData`: A string representing the image data. This should be a data URL that can be used as the `src` attribute of an `img` element.
 *   - `path`: A string representing the path of the image. This is used as the argument to the `removeImage` function when the delete button for the image is clicked.
 * - `removeImage`: A function that is called when the delete button for an image is clicked. The function should take a string argument which is the path of the image to be deleted.
 *
 * Example usage:
 *
 * ```tsx
 * <ImageListHorizontalScrolable
 *   pics={[
 *     { imageData: 'data:image/png;base64,iVBORw0...', path: '/path/to/image1.png' },
 *     { imageData: 'data:image/png;base64,ab12cd34...', path: '/path/to/image2.png' },
 *   ]}
 *   removeImage={(path) => {
 *     console.log(`Remove image at path: ${path}`);
 *   }}
 * />
 * ```
 */
const ImageListHorizontalScrolable: React.FC<ImageListHorizontalScrolableProps> = ({
  pics,
  removeImage,
  moveImage,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (scrollRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (scrollRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
          setCanScrollLeft(scrollLeft > 0);
          setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
        }
      });

      resizeObserver.observe(scrollRef.current!);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [pics]);

  const scroll = (offset: number) => {
    scrollRef.current!.scrollBy({ left: offset, behavior: 'smooth' });
    // スクロール後の位置を確認し、ボタンの状態を更新
    setTimeout(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
      }
    }, 50);
  };

  return (
    <Box style={{ position: 'relative', maxHeight: '200px', height: '200px' }}>
      {canScrollLeft && (
        <Button
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'white',
            borderRadius: '50%',
            border: 'white 1px solid',
            position: 'absolute',
            top: '55%',
            transform: 'translateY(-50%)',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            left: '54px',
            zIndex: 1001,
          }}
          onClick={() => scroll(-100)}
        >
          <IconChevronLeft />
        </Button>
      )}
      <Box
        ref={scrollRef}
        style={{
          display: 'flex',
          maxHeight: '100%',
          height: '100%',
          overflowX: 'auto',
        }}
      >
        {pics.map((pic, idx) => (
          <Box key={uuidv4()} style={{ minWidth: '160px', height: '200px', position: 'relative' }}>
            <Image
              src={pic.imgUrl}
              width="150px"
              height="auto"
              style={{ borderRadius: '15px', maxHeight: '200px' }}
            />
            <Box
              style={{
                borderRadius: '15px 15px 0 0',
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, ' +
                  'rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px',
              }}
            >
              <Group gap={4}>
                {moveImage && (
                  <>
                    <Tooltip label={t('common.moveLeft')} withArrow>
                      <ActionIcon
                        size="sm"
                        variant="filled"
                        color="dark"
                        disabled={idx === 0}
                        onClick={() => moveImage(pic.fileName, -1)}
                        aria-label="move left"
                      >
                        <IconArrowLeft size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('common.moveRight')} withArrow>
                      <ActionIcon
                        size="sm"
                        variant="filled"
                        color="dark"
                        disabled={idx === pics.length - 1}
                        onClick={() => moveImage(pic.fileName, 1)}
                        aria-label="move right"
                      >
                        <IconArrowRight size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
              </Group>
              <Tooltip label={t('common.delete')} withArrow>
                <Button
                  size="xs"
                  onClick={() => removeImage(pic.fileName)}
                  style={{
                    borderRadius: '50%',
                    border: 'white 1px solid',
                    backgroundColor: 'black',
                    color: 'white',
                  }}
                >
                  <IconTrash />
                </Button>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Box>
      {canScrollRight && (
        <Button
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'white',
            borderRadius: '50%',
            border: 'white 1px solid',
            position: 'absolute',
            top: '55%',
            transform: 'translateY(-50%)',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            right: '54px',
            zIndex: 1001,
          }}
          onClick={() => scroll(100)}
        >
          <IconChevronRight />
        </Button>
      )}
    </Box>
  );
};

export default ImageListHorizontalScrolable;
