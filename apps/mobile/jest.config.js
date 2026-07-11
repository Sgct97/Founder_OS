/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-native$": "<rootDir>/services/__tests__/mocks/react-native.ts",
    "^expo/fetch$": "<rootDir>/services/__tests__/mocks/expo-fetch.ts",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};
