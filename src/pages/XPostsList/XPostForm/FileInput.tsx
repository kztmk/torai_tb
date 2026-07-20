import React, { useRef } from 'react';
import { IconPhoto } from '@tabler/icons-react';
import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { MediaDataType } from '@/types/xAccounts';

interface FileInputProps {
  onChange: (imageData: MediaDataType) => void;
  disabled?: boolean;
}

/**
 * 画像ファイル選択用コンポーネント
 * 標準のfile inputを使用して画像を選択し、
 * Base64エンコードされた画像データを親コンポーネントに渡します。
 */
const FileInput: React.FC<FileInputProps> = ({ onChange, disabled }) => {
  const { t } = useTranslation();
  const toolTipTitle = disabled ? t('xPosts.form.mediaLimit') : t('xPosts.form.addMedia');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイル選択ダイアログを開く
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ファイル選択時の処理
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];

      const imageData = {
        file,
        fileName: file.name,
        fileId: '',
        imgUrl: '',
        mimeType: '',
        isLoading: false,
        isError: false,
      };

      onChange(imageData);

      // 同じファイルを再度選択できるようにinputをリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('画像ファイル読み込みエラー:', error);
      notifications.show({
        title: t('common.error'),
        message: t('xPosts.form.mediaReadError'),
        color: 'red',
      });
    }
  };

  return (
    <Box
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '3px',
      }}
    >
      <Tooltip label={toolTipTitle}>
        <ActionIcon onClick={openFileDialog} disabled={disabled} aria-label={t('xPosts.form.selectMedia')} size="36">
          <IconPhoto />
        </ActionIcon>
      </Tooltip>
      {/* 非表示のファイル選択入力 */}
      <input
        type="file"
        hidden
        ref={fileInputRef}
        accept="image/*, .mp4"
        onChange={handleFileChange}
      />
    </Box>
  );
};

export default FileInput;
