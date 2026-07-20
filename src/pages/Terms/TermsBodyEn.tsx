import { List, Text, Title } from '@mantine/core';

export default function TermsBodyEn() {
  return (
    <>
      <Title my="md" order={1}>Terms of Service</Title>
      <Text mb="sm" mx="lg">Last updated: April 12, 2025</Text>

      <Title my="md" order={2}>1. General</Title>
      <Text mb="sm" mx="lg">
        These Terms of Service govern the use of the Torai web application provided by Imakita
        Sangyo (the “Company”). The Service is operated in accordance with the laws and regulations
        of Japan and Canada. You may use the Service only after agreeing to these Terms.
      </Text>

      <Title my="md" order={2}>2. Definitions</Title>
      <Text mb="sm" mx="lg"><b>1. User</b><br />Any individual or organization that accesses and uses the Service.</Text>
      <Text mb="sm" mx="lg"><b>2. Google Account</b><br />An account that uses Google authentication. A Google Account is required to sign in to and use the Service.</Text>
      <Text mb="sm" mx="lg"><b>3. Registration Information</b><br />The following information supplied by a User when registering for the Service:</Text>
      <List mx="lg" my="md">
        <List.Item>Google Account information</List.Item>
        <List.Item>The entered user name and job title</List.Item>
        <List.Item>The Apps Script URL for the User’s Google Sheet</List.Item>
        <List.Item>API keys for AI providers, when AI features are used</List.Item>
      </List>
      <Text mb="sm" mx="lg"><b>4. X Account Information</b><br />Information related to X accounts and X posts. The Service does not directly record or manage this information; it is stored in Google Sheets and Google Drive owned by the User.</Text>

      <Title my="md" order={2}>3. Account Registration and Use</Title>
      <Text mb="sm" mx="lg"><b>1. Registration</b><br />The Service uses Google Account authentication. Users must provide accurate, current information when registering.</Text>
      <Text mb="sm" mx="lg"><b>2. Handling of Provided Information</b><br />Registration information is used to provide and improve the Service and is managed appropriately in accordance with applicable laws.</Text>
      <Text mb="sm" mx="lg"><b>3. Storage of X Account Data</b><br />X account information is not recorded in the Company’s systems and is managed entirely in Google Sheets and Google Drive owned by the User.</Text>

      <Title my="md" order={2}>4. Privacy and Protection of Personal Information</Title>
      <Text mb="sm" mx="lg">The Company appropriately manages personal and registration information and takes safeguards against leakage, unauthorized access, alteration, and similar risks.</Text>
      <Text mb="sm" mx="lg">Collected information will not be provided or disclosed to third parties except as required to provide or improve the Service, or as required by law.</Text>

      <Title my="md" order={2}>5. Newsletters</Title>
      <Text mb="sm" mx="lg">1. By registering for the Service, the User agrees to receive newsletters and notices from the Company at the email address used for purchase or associated with the Google Account.</Text>
      <Text mb="sm" mx="lg">2. The User may stop receiving newsletters at any time by changing their settings, using the unsubscribe procedure, or contacting the Company.</Text>

      <Title my="md" order={2}>6. Conditions of Use and Prohibited Conduct</Title>
      <Text mb="sm" mx="lg"><b>1. Conditions of Use</b><br />Users use the Service at their own risk. The Company is not liable for direct or indirect damages arising from use of the Service.</Text>
      <Text mb="sm" mx="lg"><b>2. Prohibited Conduct</b><br />Users must not engage in any of the following:</Text>
      <List mx="lg" my="md">
        <List.Item>Providing false information or inaccurate registration information</List.Item>
        <List.Item>Infringing the intellectual property, privacy, or other rights of another party</List.Item>
        <List.Item>Unauthorized access, attacks on Company systems, or other interference with operation of the Service</List.Item>
        <List.Item>Any other conduct that is socially inappropriate or that the Company determines to be inappropriate</List.Item>
      </List>
      <Text mb="sm" mx="lg">If a User violates these Terms, the Company may cancel the User’s registration or restrict use of the Service without prior notice.</Text>

      <Title my="md" order={2}>7. Intellectual Property</Title>
      <Text mb="sm" mx="lg">1. Copyrights, trademarks, and other intellectual property rights related to the Service belong to the Company or their lawful owners.</Text>
      <Text mb="sm" mx="lg">2. Users must not infringe the intellectual property rights of the Company or any third party.</Text>

      <Title my="md" order={2}>8. Disclaimer</Title>
      <Text mb="sm" mx="lg">1. Although the Company endeavors to ensure that information provided through the Service is accurate, complete, and useful, it makes no express or implied warranty regarding that information.</Text>
      <Text mb="sm" mx="lg">2. The Company is not liable when use of the Service becomes difficult due to natural disasters, system failures, or other events beyond its control.</Text>

      <Title my="md" order={2}>9. Changes to These Terms</Title>
      <Text mb="sm" mx="lg">1. The Company may revise these Terms without prior notice when it determines that a revision is necessary to operate the Service.</Text>
      <Text mb="sm" mx="lg">2. Revised Terms take effect when posted in the Service or otherwise communicated to Users.</Text>

      <Title my="md" order={2}>10. Governing Law and Jurisdiction</Title>
      <Text mb="sm" mx="lg">1. These legal terms are governed by and interpreted under the laws of Canada. Imakita Sangyo and the User unconditionally agree that Canadian courts have exclusive jurisdiction over disputes arising from these legal terms.</Text>
      <Text mb="sm" mx="lg">2. The courts with jurisdiction over the Company’s location in British Columbia have exclusive agreed jurisdiction over disputes between the User and the Company.</Text>

      <Title my="md" order={2}>11. Contact</Title>
      <Text mb="sm" mx="lg">For questions about these Terms or newsletter unsubscribing, contact:</Text>
      <List mx="lg" my="md">
        <List.Item>Company: Imakita Sangyo</List.Item>
        <List.Item>Address: 1771 Robson Street Unit 1827, Vancouver, British Columbia V6G 3B7 Canada</List.Item>
        <List.Item>Telephone: 1-672-514-5235</List.Item>
        <List.Item>Email: support@imakita3gyo.com</List.Item>
      </List>
    </>
  );
}
