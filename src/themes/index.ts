import { createTheme, MantineColorsTuple } from '@mantine/core';

// autopost の primary。虎威（藍紫 palePurple）と差別化する Bluesky 寄りの青。
const blueskyBlue: MantineColorsTuple = [
  '#f0edfc',
  '#dcd6f4',
  '#b6a9eb',
  '#8e7ae4',
  '#6d52dd',
  '#5838d9',
  '#4e2cd8',
  '#4020c0',
  '#381cac',
  '#1f0f66',
];

export const theme = createTheme({
  primaryColor: 'blueskyBlue',
  colors: {
    blueskyBlue,
  },
  fontFamily:
    '"Noto Sans JP", "M PLUS 1p", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily:
      '"Noto Sans JP", "M PLUS 1p", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});
