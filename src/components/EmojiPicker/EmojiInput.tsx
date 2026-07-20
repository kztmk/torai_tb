import { useState } from 'react';
import { IconMoodSmile } from '@tabler/icons-react';
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { ActionIcon, Popover, TextInput } from '@mantine/core';

export function EmojiInput() {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setValue((prev) => prev + emojiData.emoji);
    setIsOpen(false);
  };

  return (
    <div>
      <TextInput
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        placeholder="Enter text..."
      />

      <Popover
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        position="bottom"
        withArrow
        closeOnClickOutside
        trapFocus
      >
        <Popover.Target>
          <ActionIcon
            onClick={() => setIsOpen((o) => !o)}
            style={{ position: 'absolute', right: 10, top: 10 }}
          >
            <IconMoodSmile size={20} />
          </ActionIcon>
        </Popover.Target>

        <Popover.Dropdown>
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            searchDisabled
            height={350}
            width="100%"
            theme={Theme.AUTO}
            emojiStyle={EmojiStyle.TWITTER}
          />
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
