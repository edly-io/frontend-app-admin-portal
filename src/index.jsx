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

// Paragon + brand theme CSS is loaded at runtime by frontend-platform from
// PARAGON_THEME_URLS (indigo sets the edly brand globally), the same as every
// other Open edX MFE — so we do NOT import paragon CSS directly here.
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
