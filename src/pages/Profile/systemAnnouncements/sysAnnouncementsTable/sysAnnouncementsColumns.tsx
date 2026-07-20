import { MRT_ColumnDef } from 'mantine-react-table';
import type { TFunction } from 'i18next';
import { SystemAnnouncement } from '@/store/reducers/systemAnnouncementSlice';

const getSystemAnnouncementColumns = (t: TFunction): Array<MRT_ColumnDef<SystemAnnouncement>> => [
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: t('announcements.status'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableSorting: true,
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: t('announcements.title'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableSorting: true,
    minSize: 450,
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: t('announcements.description'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableSorting: true,
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: t('announcements.updatedAt'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableSorting: true,
  },
];

export default getSystemAnnouncementColumns;
