import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-react-table/styles.css';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { Provider } from 'react-redux';
import { ModalsProvider } from '@mantine/modals';
import Routes from './routes';
import store from './store';
import { theme } from './themes';
import LanguageSynchronizer from './i18n/LanguageSynchronizer';

const googleClientId = import.meta.env.VITE_G_OAUTH_CLIENT_ID;

function App() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Provider store={store}>
        <LanguageSynchronizer />
        <MantineProvider theme={theme}>
          <ModalsProvider>
            <Notifications position="top-center" zIndex={100000000} />
            <Routes />
          </ModalsProvider>
        </MantineProvider>
      </Provider>
    </GoogleOAuthProvider>
  );
}

export default App;
