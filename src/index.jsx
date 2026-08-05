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

// Bundle the brand theme from the app's OWN origin. Indigo swaps @edx/brand to
// the edly brand-openedx fork at build time, so this is the edly theme in the
// tutor image (and the default brand when built standalone). Bundling avoids
// the CORB block the browser applies to indigo's cross-origin
// PARAGON_THEME_URLS on raw.githubusercontent.com.
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
