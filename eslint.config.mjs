// @ts-check

import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: [
            "node_modules/",
            "dist/",
        ],
    },
    {
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            "curly": [
                "warn",
                "all",
            ],
            "@stylistic/no-trailing-spaces": [
                "warn",
            ],
            "@stylistic/no-multi-spaces": [
                "warn",
            ],
            "@stylistic/arrow-parens": [
                "warn",
                "as-needed",
                {
                    "requireForBlockBody": true,
                },
            ],
            "@stylistic/indent": [
                "warn",
                4,
            ],
            "@stylistic/quotes": [
                "warn",
                "double",
            ],
            "@stylistic/semi": [
                "warn",
                "never",
            ],
            "@stylistic/comma-dangle": [
                "warn",
                "always-multiline",
            ],
            "@stylistic/brace-style": [
                "warn",
                "1tbs",
            ],
        },
    },
]