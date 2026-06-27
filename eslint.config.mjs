import communityEslintConfig from '@sodrujestvo/community_eslint_config';

export default [
  ...communityEslintConfig,

  {
    ignores: ['.yarn', 'dist', 'index.js'],
  },
];
