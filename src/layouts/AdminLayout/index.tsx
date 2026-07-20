import { Outlet } from 'react-router-dom';
import { AppShell, Container, rem, useMantineTheme } from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import AppMain from '@/components/AppMain';
import FooterNav from '@/components/FooterNav';
import HeaderNav from '@/components/HeaderNav';
import NavigationAdmin from '@/components/NavigationAdmin';

export type SidebarState = 'hidden' | 'mini' | 'full';

export function AdminLayout() {
  const theme = useMantineTheme();
  const tablet_match = useMediaQuery('(max-width: 768px)');
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened] = useDisclosure(true);
  const [sidebarState, setSidebarState] = useLocalStorage<SidebarState>({
    key: 'mantine-nav-state',
    defaultValue: 'full',
  });

  const toggleSidebarState = () => {
    setSidebarState((current) => {
      if (current === 'full') {
        return 'mini';
      }
      if (current === 'mini') {
        return 'hidden';
      }
      return 'full';
    });
  };

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      footer={{ height: 60 }}
      navbar={{
        width: sidebarState === 'full' ? 300 : sidebarState === 'mini' ? 60 : 0,
        breakpoint: 'md',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding={0}
    >
      <AppShell.Header
        style={{
          height: rem(60),
          boxShadow: tablet_match ? theme.shadows.md : theme.shadows.sm,
        }}
      >
        <Container fluid py="sm" px="lg">
          <HeaderNav
            mobileOpened={mobileOpened}
            toggleMobile={toggleMobile}
            sidebarState={sidebarState}
            onSidebarStateChange={toggleSidebarState}
          />
        </Container>
      </AppShell.Header>
      <AppShell.Navbar>
        <NavigationAdmin
          onClose={toggleMobile}
          sidebarState={sidebarState}
          onSidebarStateChange={setSidebarState}
        />
      </AppShell.Navbar>
      <AppShell.Main>
        <AppMain>
          <Outlet />
        </AppMain>
      </AppShell.Main>
      <AppShell.Footer p="md">
        <Container fluid px="lg">
          <FooterNav />
        </Container>
      </AppShell.Footer>
    </AppShell>
  );
}
