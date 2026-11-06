module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  resolver: '<rootDir>/scripts/test-source-resolver.cjs',
  setupFilesAfterEnv: ['<rootDir>/scripts/test-setup.cjs'],
  testPathIgnorePatterns: ['/node_modules/', '/blocklet/dist/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.m?js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
  // Maintained crypto primitives are ESM. Transform them for this test runner
  // rather than replacing their production implementation.
  transformIgnorePatterns: ['/node_modules/(?!(@noble|\\.pnpm)/)'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
