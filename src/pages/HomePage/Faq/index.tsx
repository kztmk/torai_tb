import { Accordion, Container, Grid, Image, Title } from '@mantine/core';
import image from '@/assets/images/FAQs-amico.png';
import classes from './FaqWithImage.module.css';
import { useTranslation } from 'react-i18next';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function FaqWithImage() {
  const { t } = useTranslation();
  const faqData: FaqItem[] = Array.from({ length: 7 }, (_, index) => ({
    id: `faq${index + 1}`,
    question: t(`home.faq.items.${index}.question`),
    answer: t(`home.faq.items.${index}.answer`),
  }));
  return (
    <div className={classes.wrapper}>
      <Container size="lg">
        <Grid id="faq-grid" gutter={50}>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Image src={image} alt={t('home.faq.title')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Title order={2} ta="left" className={classes.title}>
              {t('home.faq.title')}
            </Title>
            <Accordion chevronPosition="right" defaultValue="reset-password" variant="separated">
              {faqData.map((item) => (
                <Accordion.Item className={classes.item} value={item.id} key={item.id}>
                  <Accordion.Control>{item.question}</Accordion.Control>
                  <Accordion.Panel>{item.answer}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}
