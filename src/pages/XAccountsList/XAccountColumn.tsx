import { type MRT_ColumnDef } from 'mantine-react-table';
import { Link } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { type XAccount } from '@/types/xAccounts';

export const getColumns = (t: TFunction): MRT_ColumnDef<XAccount>[] => [
  {
    accessorKey: 'id',
    header: 'ID',
    size: 100,
    enableEditing: false,
    visibleInShowHideMenu: false,
    enableHiding: true,
  },
  {
    accessorKey: 'name',
    header: t('xAccounts.accountName'),
    size: 150,
    Cell: ({ row }) => (
      <Link to={`/dashboard/x-accounts/${row.original.id}`}>{row.original.name}</Link>
    ),
  },
  {
    accessorKey: 'note',
    header: t('xAccounts.note'),
    size: 200,
    enableSorting: false,
  },
];
