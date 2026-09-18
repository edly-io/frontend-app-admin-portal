import { useEffect } from 'react';

const PORTAL_NAME = 'Admin Portal';

/**
 * Sets the browser tab title for a page. Pass the page's own name; the portal
 * name is appended so tabs, history entries and bookmarks stay distinguishable.
 *
 * Pages own their title: App only sets one for the blocked (non-admin) shell.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${PORTAL_NAME}` : PORTAL_NAME;
  }, [title]);
}
