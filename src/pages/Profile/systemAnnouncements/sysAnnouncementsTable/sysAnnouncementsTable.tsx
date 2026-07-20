import { useEffect, useState } from 'react';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  MantineReactTable,
  MRT_Row,
  MRT_ShowHideColumnsButton,
  MRT_ToggleDensePaddingButton,
  MRT_ToggleFiltersButton,
  MRT_ToggleGlobalFilterButton,
  useMantineReactTable,
} from 'mantine-react-table';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Box, Button, Group, Modal, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  deleteSystemAnnouncement,
  fetchSystemAnnouncement,
  SystemAnnouncement,
} from '@/store/reducers/systemAnnouncementSlice';
import SystemAnnouncementForm from './sysAnnouncementForm';
import getSystemAnnouncementColumns from './sysAnnouncementsColumns';

const SystemAnnouncementTable = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  // モーダル制御用のフック
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [currentRow, setCurrentRow] = useState<MRT_Row<SystemAnnouncement> | null>(null);
  const { isLoading, sysAnnouncements } = useAppSelector((state) => state.systemAnnouncements);

  useEffect(() => {
    console.log('fetching system announcements');
    dispatch(fetchSystemAnnouncement());
  }, []);

  const handleDeleteAccount = () => {
    if (currentRow !== null) {
      dispatch(deleteSystemAnnouncement(currentRow.original.id));
      closeDeleteModal();
    }
  };

  const table = useMantineReactTable({
    columns: getSystemAnnouncementColumns(t),
    data: sysAnnouncements,
    // editing feature
    editDisplayMode: 'modal',
    // create row
    createDisplayMode: 'modal',
    enableFullScreenToggle: false,
    enableRowActions: true,
    enableRowNumbers: true,
    enableColumnResizing: true,
    state: {
      columnVisibility: {
        id: false,
        date: true,
        status: true,
        title: true,
        description: true,
      },
    },
    defaultDisplayColumn: {
      enableResizing: true,
    },
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 140,

        visibleInShowHideMenu: false,
        mantineTableBodyCellProps: {
          style: {
            paddingLeft: '32px',
          },
        },
      },
      'mrt-row-numbers': {
        size: 48,
        visibleInShowHideMenu: false,
        mantineTableBodyCellProps: {
          align: 'center',
        },
      },
    },
    mantineTableProps: {
      style: {
        borderCollapse: 'separate',
      },
    },
    mantineTableBodyProps: {
      style: () => ({
        td: {
          paddingLeft: '0px',
        },
        tr: {
          paddingLeft: '8px',
        },
        '& td:first-of-type': {
          paddingLeft: '0px',
          paddingRight: '0px',
        },
      }),
    },
    mantineTableBodyCellProps: {
      style: {
        borderBottom: '#e0e0e0',
        backgroundColor: '#ffffff',
      },
    },
    mantineTableHeadCellProps: {
      style: {
        borderRadius: '5px 5px 0 0',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
      },
    },
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    renderCreateRowModalContent: ({ table, row }) => (
      <>
        <Modal
          opened
          closeOnClickOutside={false}
          withCloseButton={false}
          onClose={() => table.setCreatingRow(null)}
        >
          <SystemAnnouncementForm table={table} row={row} mode="add" />
        </Modal>
      </>
    ),
    renderEditRowModalContent: ({ table, row }) => (
      <>
        <Modal
          opened
          closeOnClickOutside={false}
          withCloseButton={false}
          onClose={() => table.setEditingRow(null)}
        >
          <SystemAnnouncementForm table={table} row={row} mode="edit" />
        </Modal>
      </>
    ),
    renderRowActions: ({ row, table }) => (
      <Box style={{ display: 'flex', gap: '0.2rem' }}>
        <Tooltip label={t('common.edit')}>
          <ActionIcon onClick={() => table.setEditingRow(row)}>
            <IconEdit />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('common.delete')}>
          <ActionIcon
            color="error"
            onClick={() => {
              setCurrentRow(row);
              openDeleteModal();
            }}
          >
            <IconTrash />
          </ActionIcon>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Box style={{ display: 'flex', gap: '16px', padding: '8px' }}>
        <Button variant="contained" onClick={() => table.setCreatingRow(true)}>
          {t('announcements.add')}
        </Button>
      </Box>
    ),
    renderToolbarInternalActions: ({ table }) => (
      <Group>
        <MRT_ToggleGlobalFilterButton table={table} />
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
      </Group>
    ),
  });

  return (
    <>
      <Box>
        <MantineReactTable table={table} />
      </Box>
      <Modal
        opened={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title={t('announcements.deleteTitle')}
        size="md"
        styles={{
          content: {
            borderLeft: '4px solid red',
          },
        }}
      >
        <Text>{t('announcements.deleteConfirm', { title: currentRow?.original.title ?? '' })}</Text>
        <Group justify="end" mt="md">
          <Button variant="outline" onClick={closeDeleteModal}>
            {t('common.cancel')}
          </Button>
          <Button color="red" onClick={handleDeleteAccount} loading={isLoading}>
            {t('common.delete')}
          </Button>
        </Group>
      </Modal>
    </>
  );
};

export default SystemAnnouncementTable;
