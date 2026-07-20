import { forwardRef, useImperativeHandle, useState } from 'react';
import { IconMoodSmile } from '@tabler/icons-react';
import Picker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';

type EmojiPickerProps = {
  onSelectedEmoji: (emojiData: EmojiClickData) => void;
};

export type EmojiPickerRef = {
  setShowEmoji: (showEmoji: boolean) => void;
};

const EmojiPicker = forwardRef<EmojiPickerRef, EmojiPickerProps>(({ onSelectedEmoji }, ref) => {
  const { t } = useTranslation();
  const [showEmoji, setShowEmoji] = useState(false);

  useImperativeHandle(ref, () => ({
    setShowEmoji: (showEmoji: boolean) => {
      setShowEmoji(showEmoji);
    },
  }));

  // 絵文字クリック時のハンドラー
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    // emojiDataが適切な形式で渡されていることを確認
    if (emojiData && emojiData.emoji) {
      onSelectedEmoji(emojiData);
      setShowEmoji(false); // 選択後にピッカーを閉じる
    }
  };

  return (
    <>
      <Tooltip
        arrowOffset={20}
        arrowSize={6}
        arrowRadius={1}
        label={t('xPosts.form.addEmoji')}
        withArrow
        position="top-start"
      >
        <ActionIcon
          onClick={(event) => {
            event.stopPropagation();
            setShowEmoji((showEmoji) => {
              return !showEmoji;
            });
          }}
          size="36"
        >
          <IconMoodSmile />
        </ActionIcon>
      </Tooltip>
      <Box>
        {showEmoji && (
          <Picker
            onEmojiClick={handleEmojiClick}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            searchDisabled
            height={350}
            width="100%"
            theme={Theme.AUTO}
            emojiStyle={EmojiStyle.TWITTER}
          />
        )}
      </Box>
    </>
  );
});

export default EmojiPicker;
