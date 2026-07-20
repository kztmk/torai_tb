import { IconBrandX, IconWorld } from '@tabler/icons-react';
import { ActionIcon, ActionIconProps, Container, Divider, Flex, Group } from '@mantine/core';
// import { useMediaQuery } from '@mantine/hooks';
import { Logo } from '@/components';
import classes from './FooterNav.module.css';

const ICON_SIZE = 18;

const ACTION_ICON_PROPS: ActionIconProps = {
  size: 'lg',
  color: 'primary.3',
  variant: 'transparent',
};

const FooterNav = () => {
  // const mobile_match = useMediaQuery('(max-width: 425px)');

  return (
    <footer className={classes.footer}>
      <Container fluid mb="xl">
        <Divider mt="xl" mb="md" />
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: 'sm', sm: 'lg' }}
          justify={{ base: 'center', sm: 'space-between' }}
          align={{ base: 'center' }}
        >
          <Logo c="white" />
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <ActionIcon
              component="a"
              href="https://doc-torai.try-try.com/"
              target="_blank"
              {...ACTION_ICON_PROPS}
            >
              <IconWorld size={ICON_SIZE} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              component="a"
              href="https://x.com/bungo_ai_nosuke"
              target="_blank"
              {...ACTION_ICON_PROPS}
            >
              <IconBrandX size={ICON_SIZE} />
            </ActionIcon>
          </Group>
        </Flex>
      </Container>
    </footer>
  );
};

export default FooterNav;
