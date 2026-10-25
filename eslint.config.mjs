import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Plain apostrophes in JSX text render correctly; escaping them is churn.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
