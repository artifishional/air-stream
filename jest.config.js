module.exports = {
  moduleFileExtensions: [
    'mjs',
    'js',
    'json',
    'jsx',
    'ts',
    'tsx',
    'node',
  ],
  testEnvironment: 'node',
  testMatch: [
    '**/stream2/test/**/index.js',
  ],
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.mjs$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/.*',
  ],
};
