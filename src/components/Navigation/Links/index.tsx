import { useEffect, useMemo, useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Collapse, Group, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import classes from './Links.module.css';

interface LinksGroupProps {
  icon?: any;
  label: string;
  initiallyOpened?: boolean;
  link?: string;
  links?: {
    label: string;
    link: string;
  }[];
  closeSidebar: () => void;
  isMini?: boolean;
}

export function LinksGroup(props: LinksGroupProps) {
  const { icon: Icon, label, initiallyOpened, link, links, closeSidebar, isMini } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);
  const [_currentPath, setCurrentPath] = useState<string | undefined>();
  const ChevronIcon = IconChevronRight;

  const LinkItem = ({ link }: { link: { label: string; link: string } }) => {
    const { label, link: url } = link;
    console.log('url', url);
    // 外部リンクはアンカータグで開く
    if (url.startsWith('http')) {
      console.log('external link', url);
      return (
        <Text
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.link}
          data-mini={isMini}
        >
          {label}
        </Text>
      );
    }
    // 内部リンクはボタンで navigate
    return (
      <Text
        component="button"
        className={classes.link}
        onClick={() => {
          navigate(url);
          closeSidebar();
        }}
        data-active={url.toLowerCase() === pathname || undefined}
        data-mini={isMini}
      >
        {label}
      </Text>
    );
  };

  const items = (hasLinks ? links : []).map((link) =>
    isMini ? (
      <Menu.Item key={`menu-${link.label}`}>
        <LinkItem link={link} />
      </Menu.Item>
    ) : (
      <LinkItem key={link.label} link={link} />
    )
  );

  const content: React.ReactElement = useMemo(() => {
    let view: React.ReactElement;
    if (isMini) {
      view = (
        <>
          <Menu
            position="right-start"
            withArrow
            arrowPosition="center"
            trigger="hover"
            openDelay={100}
            closeDelay={400}
          >
            <Menu.Target>
              <UnstyledButton
                onClick={() => {
                  setOpened((o) => !o);
                  link && navigate(link || '#');
                  closeSidebar();
                }}
                className={classes.control}
                data-active={opened || undefined}
                data-mini={isMini}
              >
                <Tooltip label={label} position="right" transitionProps={{ duration: 0 }}>
                  <Icon size={24} />
                </Tooltip>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>{items}</Menu.Dropdown>
          </Menu>
        </>
      );
    } else {
      view = (
        <>
          {!hasLinks && link?.startsWith('http') ? (
            <Text
              component="a"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={classes.control}
              data-mini={isMini}
            >
              <Group justify="flex-start" gap={0}>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} />
                  {!isMini && <Box ml="md">{label}</Box>}
                </Box>
              </Group>
            </Text>
          ) : (
            <UnstyledButton
              onClick={() => {
                setOpened((o) => !o);
                link && navigate(link || '#');
                closeSidebar();
              }}
              className={classes.control}
              data-active={opened || undefined}
              data-mini={isMini}
            >
              <Group justify="space-between" gap={0}>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} />
                  {!isMini && <Box ml="md">{label}</Box>}
                </Box>
                {hasLinks && (
                  <ChevronIcon
                    className={classes.chevron}
                    size="1rem"
                    stroke={1.5}
                    style={{ transform: opened ? `rotate(90deg)` : 'none' }}
                  />
                )}
              </Group>
            </UnstyledButton>
          )}
          {hasLinks ? <Collapse in={(!isMini && hasLinks) || opened}>{items}</Collapse> : null}
        </>
      );
    }

    return view;
  }, [ChevronIcon, Icon, closeSidebar, hasLinks, isMini, items, label, link, opened, navigate]);

  useEffect(() => {
    const paths = pathname.split('/');
    setOpened(paths.includes(label.toLowerCase()));
    setCurrentPath(paths[paths.length - 1]?.toLowerCase() || undefined);
  }, [pathname, label]);

  return <>{content}</>;
}
