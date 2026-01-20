import baseConfig from '@suufr/eslint-config/base';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...baseConfig,
];
