import { createTheme, MantineColorsTuple } from '@mantine/core';

const palePurple: MantineColorsTuple = [
  '#f1f1ff',
  '#e0dff2',
  '#bfbdde',
  '#9b98ca',
  '#7d79b9',
  '#6a66af',
  '#605cac',
  '#504c97',
  '#464388',
  '#3b3979',
];

export const theme = createTheme({
  primaryColor: 'palePurple',
  colors: {
    palePurple,
  },
  fontFamily:
    '"Noto Sans JP", "M PLUS 1p", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily:
      '"Noto Sans JP", "M PLUS 1p", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});
