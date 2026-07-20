import { Box, Group, RingProgress } from '@mantine/core';

const X_POST_TEXTLENGTH_LIMIT = 280;

const CircularWithLabel = (props: { value: number; size: number }) => {
  const { value, size, ...others } = props;
  const percentage = Math.round((value / X_POST_TEXTLENGTH_LIMIT) * 100);

  return (
    <Box style={{ position: 'relative', display: 'inline-flex' }}>
      <Group gap="xs">
        <RingProgress
          sections={[{ value: percentage, color: percentage > 79 ? 'red' : 'green' }]}
          size={size}
          {...others}
        />
        <Box style={{ textAlign: 'center' }}>
          <div>{percentage}%</div>
        </Box>
      </Group>
    </Box>
  );
};

export default CircularWithLabel;
