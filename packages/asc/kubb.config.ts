import { defineConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginZod } from '@kubb/plugin-zod'
import { pluginClient } from '@kubb/plugin-client'

export default defineConfig({
  root: '.',
  input: {
    path: './openapi.json',
  },
  output: {
    path: './src/gen',
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: {
        path: 'models',
      },
    }),
    pluginClient({
      group: {
        type: 'tag',
        name({ group }) {
          return `${group}Client`
        },
      },
    }),
    pluginReactQuery({
      output: {
        path: 'hooks',
      },
      group: {
        type: 'tag',
        name({ group }) {
          return `${group}Controller`
        },
      },
    }),
    pluginZod({
      output: {
        path: 'zod',
      },
    }),
  ],
})
