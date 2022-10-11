import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import camelCase from 'lodash.camelcase';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json' assert {type: 'json'};

const libraryName = 'paperjsOffsetCore'

const defaultPlugins = [
  json(),
  typescript({ useTsconfigDeclarationDir: true }),
  commonjs(),
  nodeResolve(),
  sourcemaps(),
  // nodePolyfills()
]

let tasks = []

tasks.push(rollup({
  input: 'src/index.ts',
  external: ['paper/dist/paper-core'],
  plugins: defaultPlugins
}).then(bundle => {
  bundle.write({ format: 'umd', file: pkg.main, name: camelCase(libraryName), sourcemap: true })
  bundle.write({ format: 'es', file: pkg.module, name: camelCase(libraryName), sourcemap: true })
  bundle.write({ format: 'es', file: `demo/paperjs-offset-core.esm.js`, sourcemap: true })
}))

tasks.push(rollup({
  input: 'src/index.ts',
  external: ['paper/dist/paper-core'],
  plugins: defaultPlugins.concat([terser()])
}).then(bundle => {
  bundle.write({ format: 'umd', name: camelCase(libraryName), file: `dist/paperjs-offset-core.umd.min.js`, sourcemap: false })
  bundle.write({ format: 'es', file: `dist/paperjs-offset-core.esm.min.js`, sourcemap: false })
  bundle.write({ format: 'es', file: `demo/paperjs-offset-core.esm.min.js`, sourcemap: false })
}))

// tasks.push(rollup({
//   input: 'src/bundle.ts',
//   external: ['paper/dist/paper-core'],
//   plugins: defaultPlugins
// }).then(bundle => {
//   bundle.write({ format: 'es', file: 'dist/paperjs-offset.js', sourcemap: false })
//   bundle.write({ format: 'es', file: 'demo/paperjs-offset.js', sourcemap: false })
// }))

// tasks.push(rollup({
//   input: 'src/bundle.ts',
//   external: ['paper/dist/paper-core'],
//   plugins: defaultPlugins.concat([terser()])
// }).then(bundle => {
//   bundle.write({ format: 'iife', file: 'dist/paperjs-offset.min.js', sourcemap: false })
//   bundle.write({ format: 'iife', file: 'demo/paperjs-offset.min.js', sourcemap: false })
// }))

Promise.all(tasks).then(() => {
  setTimeout(() => {
    process.exit()
  }, 3000)
})