/* eslint-disable import/no-extraneous-dependencies */
// Test-only helper: pulls in RTL and react-intl (test/transitive deps).
import React from 'react';
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

/**
 * Render a component wrapped in the providers Paragon/our pages need:
 * IntlProvider (Paragon ModalDialog/Toast use react-intl) and a Router.
 */
export const renderWithProviders = (ui, { route = '/' } = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
  </IntlProvider>,
);

// Re-export everything from RTL so tests import from one place.
export * from '@testing-library/react';
