module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    babelOptions: { presets: ['@babel/preset-react'] }
  },
  env: { browser: true, node: true, es2022: true },
  plugins: ['react-hooks'],
  globals: { React: 'readonly', JSX: 'readonly', process: 'readonly' },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'no-undef': 'error',
    'no-redeclare': 'error',
  },
  settings: { react: { version: 'detect' } }
};
