// Pinned to en-US (mm/dd/yyyy) instead of the browser's locale, so the app
// reads the same for every admin regardless of their machine's settings.
export const formatDate = (value) => new Date(value).toLocaleDateString('en-US', {
  month: '2-digit', day: '2-digit', year: 'numeric',
});

export const formatDateTime = (value) => new Date(value).toLocaleString('en-US', {
  month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
