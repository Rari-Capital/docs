module.exports = {
  plugins: ['markdown'],
  rules: {
    // indent with 2 spaces
    indent: [2, 2, { SwitchCase: 1 }],
    // disable semi
    semi: [2, 'never'],
    // allow comments begin with a lowercase character
    'capitalized-comments': 0,
    // enforce consistent spacing inside braces (object-curly-spacin
    'object-curly-spacing': ['error', 'always'],
    // to allow: if (false) return
    curly: ['error', 'multi-line'],
    // to allow something like: fn && fn()
    'no-unused-expressions': [
      'error',
      {
        allowShortCircuit: true
      }
    ]
  }
}
