const { createConfig } = require('@openedx/frontend-build');

module.exports = createConfig('eslint', {
  rules: {
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
  },
});
