import React, { useCallback, useEffect, useState } from 'react';
import { Avatar, Box, Button, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { useTranslation } from 'react-i18next';
import classes from './AvatarDropzone.module.css';

interface FileWithPreview extends File {
  preview: string;
}

// Create a custom props interface that doesn't directly extend DropzoneProps
interface ImageUploadProps {
  onFilesSelected: (files: File[]) => void;
  defaultUrl?: string;
  // Add any other props you need, but don't extend DropzoneProps directly
}

const AvatarDropzone: React.FC<ImageUploadProps> = ({ onFilesSelected, defaultUrl }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      if (acceptedFiles.length !== 0) {
        const filesWithPreview = acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );
        setFiles(filesWithPreview);
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const onReject = useCallback((fileRejections: any[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      fileRejections.forEach((file) => {
        file.errors.forEach((err: any) => {
          if (err.code === 'file-invalid-type') {
            setError('File must be an image file');
          }
          if (err.code === 'file-too-large') {
            setError('File size over 2MB');
          }
        });
      });
    }
  }, []);

  const removeFile = () => {
    setFiles([]);
    setError(null);
  };

  const thumbs = files.map((file) => (
    <Box
      key={file.name}
      style={{
        width: '115px',
        height: '115px',
        borderRadius: '50%',
        overflow: 'hidden',
        objectFit: 'cover',
        objectPosition: 'center',
        position: 'relative',
      }}
    >
      <img src={file.preview} alt={file.name} style={{ width: '100%', height: '100%' }} />
    </Box>
  ));

  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [files]);

  return (
    <Box style={{ margin: 1 }}>
      <Dropzone
        onDrop={onDrop}
        onReject={onReject}
        accept={IMAGE_MIME_TYPE}
        maxSize={1024 * 1024 * 2}
        className={classes.root}
      >
        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: '8px' }}>
          {thumbs}
          {thumbs.length === 0 && (
            <Box
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
              }}
              className={classes.root}
            >
              <Avatar style={{ width: '100%', height: '100%' }} src={defaultUrl} alt="default" />
            </Box>
          )}
        </Box>
      </Dropzone>
      {files.length > 0 && (
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '8px',
          }}
        >
          <Button onClick={removeFile} variant="outline" color="gray" style={{ mt: 2 }}>
            {t('common.delete')}
          </Button>
        </Box>
      )}
      {error && (
        <Text c="red" size="sm" style={{ mt: 2 }}>
          {error}
        </Text>
      )}
    </Box>
  );
};

export default AvatarDropzone;
