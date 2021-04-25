# ESLint config for 🍷Sherry🍷

<img src="./media/vermouth.jpeg" alt="sherry" width="300">

This config is supposed to work with [XO](https://github.com/sindresorhus/xo) or [eslint-config-xo](https://github.com/sindresorhus/eslint-config-xo).

## Features

- Indent with 2 spaces and no semicolon
- [Lint code blocks in Markdown!](#lint-code-blocks-in-markdown)
- [Enforce consistent spacing inside](https://eslint.org/docs/rules/object-curly-spacing)
- [Require Following Curly Brace Conventions with `multi` option](https://eslint.org/docs/rules/curly#multi)
- [Disallow unused expressions](https://eslint.org/docs/rules/no-unused-expressions)

## Install

```bash
yarn add -D eslint-config-sherry
# OR: npm install -D eslint eslint-config-sherry
```

## Usage

In ESLint:

```js
/* package.json */
{
  "eslintConfig": {
    "extends": ["xo/esnext", "sherry"]
  }
}
```

Or in XO:

```js
/* package.json */
{
  "xo": {
    "extends": "sherry"
  }
}
```

### Use Prettier

```js
/* package.json */
{
  "xo": {
    "extends": "sherry/prettier"
  }
}
```

### Lint code blocks in markdown

It uses [eslint-plugin-markdown](https://github.com/eslint/eslint-plugin-markdown):

```json
{
  "xo": {
    "extensions": ["md"]
  }
}
```

## Author

**Sherry** © <img src="https://avatars2.githubusercontent.com/u/45230194?s=14"> [Sherry Team](https://github.com/sherry), Released under the [MIT](./LICENSE) License.<br>
Authored and maintained by ULIVZ with help from contributors ([list](https://github.com/sherry/eslint-config-sherry/contributors)).
