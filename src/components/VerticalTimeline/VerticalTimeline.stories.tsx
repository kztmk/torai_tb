import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { IconBrandInstagram, IconBrandTwitter, IconStar, IconTrash } from '@tabler/icons-react';
import { VerticalTimeline, VerticalTimelineElement } from './';

// CSSモジュールは自動的にコンポーネントにインポートされるため、
// ここで明示的にインポートする必要はありません

const meta = {
  title: 'Components/VerticalTimeline',
  component: VerticalTimeline,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    animate: {
      control: 'boolean',
      description: 'アニメーション効果を有効にするかどうか',
    },
    layout: {
      control: 'select',
      options: ['1-column-left', '1-column', '2-columns', '1-column-right'],
      description: 'タイムラインのレイアウト',
    },
    lineColor: {
      control: 'color',
      description: 'タイムラインの線の色',
    },
  },
} satisfies Meta<typeof VerticalTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// ★ 要素のデータ型を定義 (例)
interface TimelineItem {
  id: string;
  className: string;
  date: string;
  icon: React.ReactNode;
  iconStyle: React.CSSProperties;
  position?: 'left' | 'right';
  title: string;
  subtitle?: string;
  description: string;
  shadowSize?: 'small' | 'medium' | 'large';
}

// ★ 初期データ
const initialItems: TimelineItem[] = [
  {
    id: 'item-1',
    className: 'vertical-timeline-element--work',
    date: '2023年',
    icon: <IconStar />,
    iconStyle: { background: '#3498db', color: '#fff' },
    position: 'left',
    title: 'イベント1',
    subtitle: '東京',
    description:
      'これは最初のイベントの説明です。タイムラインの項目には説明文を入れることができます。',
  },
  {
    id: 'item-2',
    className: 'vertical-timeline-element--work',
    date: '2024年',
    icon: <IconBrandTwitter />,
    iconStyle: { background: '#e74c3c', color: '#fff' },
    position: 'right',
    title: 'イベント2',
    subtitle: '大阪',
    description:
      'これは2番目のイベントの説明です。異なるアイコンと色を使用して、視覚的な区別を付けることができます。',
  },
  {
    id: 'item-3',
    className: 'vertical-timeline-element--education',
    date: '2025年',
    icon: <IconBrandInstagram />,
    iconStyle: { background: '#2ecc71', color: '#fff' },
    position: 'left',
    title: 'イベント3',
    subtitle: '名古屋',
    description: '3番目のイベントです。さまざまなコンテンツを含めることができます。',
  },
];

// 基本的なタイムラインのストーリー
export const Default: Story = {
  args: {
    // argsはVerticalTimelineのpropsのみ
    animate: true,
    layout: '2-columns',
    lineColor: '#3498db',
    children: null, // childrenは使用しないのでnull
    // children は削除し、render関数を使用する
  },
  // ★ render関数を使って状態管理と要素のマッピングを行う
  render: (args) => {
    // ★ useStateで要素リストを管理
    const [items, setItems] = useState<TimelineItem[]>(initialItems);

    // ★ 削除ハンドラ
    const handleDelete = (idToDelete: string) => {
      setItems((prevItems) => prevItems.filter((item) => item.id !== idToDelete));
      console.log(`Deleted item with id: ${idToDelete}`); // 削除ログ (任意)
    };

    return (
      <VerticalTimeline {...args}>
        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#868e96' }}>タイムライン要素がありません。</p> // ★ 空の場合の表示
        ) : (
          items.map((item) => (
            <VerticalTimelineElement
              key={item.id} // ★ Reactのリストレンダリングにはkeyが必要
              id={item.id} // ★ 要素の識別子としてidを渡す
              className={item.className}
              date={item.date}
              icon={item.icon}
              iconStyle={item.iconStyle}
              position={item.position}
              shadowSize={item.shadowSize}
              onDelete={handleDelete} // ★ 削除ハンドラを渡す
            >
              <h3 className="vertical-timeline-element-title">{item.title}</h3>
              {item.subtitle && (
                <h4 className="vertical-timeline-element-subtitle">{item.subtitle}</h4>
              )}
              <p>{item.description}</p>
            </VerticalTimelineElement>
          ))
        )}
      </VerticalTimeline>
    );
  },
};

// 1カラムレイアウトのバリエーション
export const OneColumnLayout: Story = {
  args: {
    animate: true,
    layout: '1-column',
    lineColor: '#9b59b6',
    children: (
      <>
        <VerticalTimelineElement
          id="1"
          className="vertical-timeline-element--work"
          date="2023年1月"
          icon={<IconStar />}
          onDelete={() => console.log('Delete item 1')}
          iconStyle={{ background: '#9b59b6', color: '#fff' }}
        >
          <h3 className="vertical-timeline-element-title">1カラムレイアウト</h3>
          <p>これは1カラムレイアウトの例です。すべての要素が同じ側に配置されます。</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          id="2"
          className="vertical-timeline-element--work"
          date="2023年2月"
          icon={<IconBrandTwitter />}
          onDelete={() => console.log('Delete item 1')}
          iconStyle={{ background: '#9b59b6', color: '#fff' }}
        >
          <h3 className="vertical-timeline-element-title">2番目の項目</h3>
          <p>1カラムレイアウトでの2番目の項目です。</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          id="3"
          className="vertical-timeline-element--work"
          date="2023年3月"
          icon={<IconBrandInstagram />}
          onDelete={() => console.log('Delete item 1')}
          iconStyle={{ background: '#9b59b6', color: '#fff' }}
        >
          <h3 className="vertical-timeline-element-title">3番目の項目</h3>
          <p>1カラムレイアウトでの3番目の項目です。</p>
        </VerticalTimelineElement>
      </>
    ),
  },
};

// アニメーションなしのバージョン
export const NoAnimation: Story = {
  args: {
    animate: false,
    layout: '2-columns',
    lineColor: '#f1c40f',
    children: (
      <>
        <VerticalTimelineElement
          id="no-animation-1"
          className="vertical-timeline-element--work"
          date="2023年"
          onDelete={() => console.log('Delete item 1')}
          icon={<IconStar />}
          iconStyle={{ background: '#f1c40f', color: '#fff' }}
          position="left"
        >
          <h3 className="vertical-timeline-element-title">アニメーションなし</h3>
          <p>このタイムラインにはアニメーション効果がありません。</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          id="no-animation-2"
          className="vertical-timeline-element--work"
          date="2024年"
          onDelete={() => console.log('Delete item 1')}
          icon={<IconBrandTwitter />}
          iconStyle={{ background: '#f1c40f', color: '#fff' }}
          position="right"
        >
          <h3 className="vertical-timeline-element-title">2番目の項目</h3>
          <p>アニメーションなしの2番目の項目です。</p>
        </VerticalTimelineElement>
      </>
    ),
  },
};

// 異なるシャドウサイズのある要素を含むタイムライン
export const DifferentShadowSizes: Story = {
  args: {
    animate: true,
    layout: '2-columns',
    lineColor: '#1abc9c',
    children: (
      <>
        <VerticalTimelineElement
          id="shadow-small"
          className="vertical-timeline-element--work"
          date="2023年"
          onDelete={() => console.log('Delete item 1')}
          icon={<IconStar />}
          iconStyle={{ background: '#1abc9c', color: '#fff' }}
          position="left"
          shadowSize="small"
        >
          <h3 className="vertical-timeline-element-title">小さい影</h3>
          <p>この要素には小さいサイズの影があります。</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          id="shadow-medium"
          className="vertical-timeline-element--work"
          date="2024年"
          onDelete={() => console.log('Delete item 1')}
          icon={<IconBrandTwitter />}
          iconStyle={{ background: '#1abc9c', color: '#fff' }}
          position="right"
          shadowSize="medium"
        >
          <h3 className="vertical-timeline-element-title">中くらいの影</h3>
          <p>この要素には中くらいのサイズの影があります。</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          id="shadow-large"
          className="vertical-timeline-element--education"
          date="2025年"
          onDelete={() => console.log('Delete item 1')}
          icon={<IconBrandInstagram />}
          iconStyle={{ background: '#1abc9c', color: '#fff' }}
          position="left"
          shadowSize="large"
        >
          <h3 className="vertical-timeline-element-title">大きい影</h3>
          <p>この要素には大きいサイズの影があります。</p>
        </VerticalTimelineElement>
      </>
    ),
  },
};
