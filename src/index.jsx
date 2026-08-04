import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
} from '@openedx/frontend-platform';
import { AppProvider, ErrorPage } from '@openedx/frontend-platform/react';
import { createRoot } from 'react-dom/client';
import React from 'react';

import App from './App';
import messages from './i18n';

import './index.scss';

const render = (children) => {
  const root = createRoot(document.getElementById('root'));
  root.render(children);
};

subscribe(APP_READY, () => {
  render(<AppProvider><App /></AppProvider>);
});

subscribe(APP_INIT_ERROR, (error) => {
  render(<ErrorPage message={error.message} />);
});

initialize({
  messages,
  requireAuthenticatedUser: true,
});
