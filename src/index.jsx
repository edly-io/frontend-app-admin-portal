import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage } from '@edx/frontend-platform/react';
import { createRoot } from 'react-dom/client';
import React from 'react';

import App from './App';
import messages from './i18n';

// Ulmo paragon ships compiled CSS (no scss partials). Load the default theme.
import '@openedx/paragon/dist/core.css';
import '@openedx/paragon/dist/light.css';
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
