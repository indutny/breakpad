module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['airbnb-base', 'prettier'],
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-restricted-syntax': 'off',
    'no-continue': 'off',
    'class-methods-use-this': 'off',
    yoda: 'off',
    'import/extensions': ['error', { js: 'always' }],
  },
};
