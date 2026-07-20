import { ElementType, Suspense } from 'react';
// project-imports
import Loader from './';

const Loadable = (Component: ElementType) => {
  const LoadableComponent = (props: any) => (
    <Suspense fallback={<Loader />}>
      <Component {...props} />
    </Suspense>
  );
  return LoadableComponent;
};

export default Loadable;
