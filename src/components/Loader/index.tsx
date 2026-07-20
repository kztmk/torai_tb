import React, { useEffect, useState } from 'react';
import { Progress } from '@mantine/core';
import styles from './Loader.module.css'; // Import the CSS module

interface LoaderProps {
  color?: string; // プログレスバーの色をカスタマイズ可能にする
}

const Loader: React.FC<LoaderProps> = ({ color = 'blue' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        const newProgress = prevProgress + 10; // Increment progress by 10 each time
        return newProgress > 100 ? 0 : newProgress; // Reset to 0 if it exceeds 100
      });
    }, 300); // Update progress every 300ms

    return () => clearInterval(interval); // Clear interval on unmount
  }, []);

  return (
    <div className={styles.loaderContainer}>
      {' '}
      {/* Use the CSS module class */}
      <Progress.Root size="xl">
        <Progress.Section value={progress} color={color}>
          <Progress.Label>{`${progress}%`}</Progress.Label>
        </Progress.Section>
      </Progress.Root>
    </div>
  );
};

export default Loader;
