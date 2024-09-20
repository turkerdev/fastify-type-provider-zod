import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        globals: true,
        watch: false,
        environment: "node",
        reporters: ["verbose"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["test/**/*.ts"],
            reporter: ["text", "lcov"],
            all: true,
            thresholds: {
                statements: 95,
                branches: 90,
                functions: 100,
                lines: 95,
            },
        },
    },
})
