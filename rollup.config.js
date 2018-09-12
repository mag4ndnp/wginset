import path from 'path'
// import license from 'rollup-plugin-license'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'

export default {
  entry: path.join(__dirname, './src/js/main.js'),
  dest: path.join(__dirname, './dist/js/wg-inset.js'),
  format: 'umd',
  plugins: [
    nodeResolve({ jsnext: true }), // npmモジュールを`node_modules`から読み込む
    commonjs(), // CommonJSモジュールをES6に変換
    babel() // ES5に変換
  ],
  external: ['jquery']
}
