module.exports = {
  plugins: ['stylelint-scss', 'stylelint-no-unresolved-module'],
  extends: ['stylelint-config-recommended', 'stylelint-config-standard-scss'],
  rules: {
    'at-rule-no-unknown': null,
    'scss/at-rule-no-unknown': true,
    'scss/selector-no-union-class-name': true,

    'no-descending-specificity': true,

    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],
    'plugin/no-unresolved-module': {
      modules: ['node_modules', '.'],
    },
  },
};
