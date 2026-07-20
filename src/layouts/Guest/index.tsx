import { Outlet } from 'react-router-dom';
import { AppShell, Box, useMantineTheme } from '@mantine/core';
import { useHeadroom } from '@mantine/hooks';
import FooterNav from '@/layouts/Guest/FooterNav';
import HeaderNav from '@/layouts/Guest/HeaderNav';

function GuestLayout() {
  const theme = useMantineTheme();
  const pinned = useHeadroom({ fixedAt: 120 });

  return (
    <>
      <AppShell header={{ height: 60, collapsed: !pinned, offset: false }}>
        <AppShell.Header>
          <HeaderNav />
        </AppShell.Header>
        <AppShell.Main>
          <Box style={{ backgroundColor: theme.colors.gray[0] }}>
            <Outlet />
          </Box>
          <FooterNav />
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default GuestLayout;
