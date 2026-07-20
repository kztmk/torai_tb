import { Button, Group, Modal, Text } from '@mantine/core';

export interface DeletionConfirmationAlertProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmButtonText: string;
  cancelButtonText: string;
}

const DeletionConfirmationAlert = (props: DeletionConfirmationAlertProps) => {
  const { open, onClose, title, message, onConfirm, confirmButtonText, cancelButtonText } = props;
  return (
    <Modal
      opened={open}
      onClose={() => onClose()}
      title={title}
      size="md"
      styles={{
        content: {
          borderLeft: '4px solid red',
        },
      }}
    >
      <Text>{message}</Text>
      <Group justify="end" mt="md">
        <Button variant="outline" onClick={() => onClose()}>
          {cancelButtonText}
        </Button>
        <Button color="red" onClick={() => onConfirm()}>
          {confirmButtonText}
        </Button>
      </Group>
    </Modal>
  );
};

export default DeletionConfirmationAlert;
