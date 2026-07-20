import { ReactNode } from 'react';
import { AdminLayout } from '../';

export type SidebarState = 'hidden' | 'mini' | 'full';

type Props = {
  children: ReactNode;
};

function AppsLayout({ children }: Props) {
  // @ts-ignore
  return <AdminLayout>{children}</AdminLayout>;
}

export default AppsLayout;
