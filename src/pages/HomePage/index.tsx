import { Container, Stack } from '@mantine/core';
import { Bunner01ImageLeft } from './Bunner01/Bunner01ImageLeft';
import { Bunner02ImageRight } from './Bunner02/Bunner02ImageRight';
import { Bunner03ImageLeft } from './Bunner03/Bunner03ImageLeft';
import { Bunner04ImageRight } from './Bunner04/Bunner04ImageRight';
import { CallToAction } from './CallToAction';
import { FaqWithImage } from './Faq';
import { FeaturesAsymmetrical } from './FeaturesAsymmetrical';
import { FeaturesWithCards } from './FeaturesWithCards';
import { Hero2 } from './Hero2';
import PriceTable from './PriceTable';

const HomePage = () => {
  return (
    <Container>
      <Hero2 />
      <FeaturesWithCards />
      <CallToAction />
      <Stack align="stretch" justify="center" gap="sm">
        <Bunner01ImageLeft />
        <Bunner02ImageRight />
        <Bunner03ImageLeft />
        <Bunner04ImageRight />
      </Stack>
      <CallToAction />
      <FeaturesAsymmetrical />
      <PriceTable />
      <CallToAction />
      <FaqWithImage />
    </Container>
  );
};

export default HomePage;
