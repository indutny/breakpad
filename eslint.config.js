import prettier from 'eslint-config-prettier';
import ava from 'eslint-plugin-ava';

export default {
  plugins: {
    prettier,
    ava,
  },
  rules: {
    'no-restricted-syntax': 'off',
    'no-continue': 'off',
    'class-methods-use-this': 'off',
    'no-bitwise': 'error',
    'no-plusplus': 'error',
    yoda: 'off',
  },
  ignores: ['bench.js'],
};
