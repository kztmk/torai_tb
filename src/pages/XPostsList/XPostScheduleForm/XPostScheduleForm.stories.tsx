import { useState } from 'react';
import XPostScheduleForm, { ScheduleData } from '.';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Pages/XPostsList/XPostScheduleForm',
  component: XPostScheduleForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    dialogOpen: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '1em', maxWidth: '500px', width: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof XPostScheduleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// ラッパーコンポーネントでstateを管理
const XPostScheduleFormWrapper = (args: { dialogOpen: boolean }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(args.dialogOpen);

  const handleSetSchedule = (data: ScheduleData | null) => {
    setScheduleData(data);
    setDialogOpen(false);
    console.log('Schedule set:', data);
  };

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        style={{ padding: '8px 16px', cursor: 'pointer' }}
      >
        スケジュール設定を開く
      </button>
      {scheduleData && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #eaeaea' }}>
          <h4>設定されたスケジュール</h4>
          <pre>
            {JSON.stringify(
              scheduleData,
              (key, value) => {
                if (
                  key === 'startDate' ||
                  key === 'endDate' ||
                  key === 'startTime' ||
                  key === 'endTime'
                ) {
                  return value?.format?.('YYYY-MM-DD HH:mm:ss') || value;
                }
                return value;
              },
              2
            )}
          </pre>
        </div>
      )}
      <XPostScheduleForm
        setSchedule={handleSetSchedule}
        dialogOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};

// デフォルトの状態
export const Default: Story = {
  render: (args) => <XPostScheduleFormWrapper {...args} />,
  args: {
    dialogOpen: false,
    setSchedule: (data: ScheduleData | null) => {
      console.log('Schedule set:', data);
    },
    onClose: () => {
      console.log('Dialog closed');
    },
  },
};

// 初期表示でダイアログが開いている状態
export const OpenByDefault: Story = {
  render: (args) => <XPostScheduleFormWrapper {...args} />,
  args: {
    dialogOpen: true,
    setSchedule: (data: ScheduleData | null) => {
      console.log('Schedule set:', data);
    },
    onClose: () => {
      console.log('Dialog closed');
    },
  },
};
