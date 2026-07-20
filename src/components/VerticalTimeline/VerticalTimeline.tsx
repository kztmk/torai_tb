import React, { ReactNode } from 'react';
import classNames from 'classnames';
import classes from './VerticalTimeline.module.css';

interface VerticalTimelineProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  layout?: '1-column-left' | '1-column' | '2-columns' | '1-column-right';
  lineColor?: string;
}

const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
  animate = true,
  className = '',
  layout = '2-columns',
  lineColor = '#dee2e6',
  children,
}) => {
  return (
    <div
      className={classNames(classes['vertical-timeline'], className, {
        [classes['vertical-timeline--animate']]: animate,
        [classes['vertical-timeline--two-columns']]: layout === '2-columns',
        [classes['vertical-timeline--one-column-left']]:
          layout === '1-column' || layout === '1-column-left',
        [classes['vertical-timeline--one-column-right']]: layout === '1-column-right',
      })}
      style={{ '--line-color': lineColor } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default VerticalTimeline;
