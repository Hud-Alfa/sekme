// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
  {
    // `react-hooks/immutability` comes from the React Compiler rule set and
    // does not model Reanimated shared values: writing `sv.value` from a
    // gesture or press handler is the documented way to use them, and doing it
    // off the render path is exactly why they exist. Left on, it reports every
    // animated component in the design system as an error and buries the
    // findings that matter.
    files: ['src/ui/**/*.tsx', 'src/components/**/*.tsx', 'src/app/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',

      // Every occurrence in the series is a guarded "seed this form when the
      // sheet opens" effect, which the React Compiler rule set flags on
      // principle. It is worth seeing, but it is not a defect, and as an
      // error it would make a red lint run the normal state of the repo --
      // which is how the findings that do matter get ignored.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
