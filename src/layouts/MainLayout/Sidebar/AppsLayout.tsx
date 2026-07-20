import { ReactNode } from 'react';
import { MainLayout } from '..';

export type SidebarState = 'hidden' | 'mini' | 'full';

type Props = {
  children: ReactNode;
};

function AppsLayout({ children }: Props) {
  // @ts-ignore
  return <MainLayout>{children}</MainLayout>;
}

export default AppsLayout;
