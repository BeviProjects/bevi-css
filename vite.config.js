import { defineConfig } from 'vite'
import { resolve } from 'path'
import * as sass from 'sass'
import fs from 'fs/promises'

const modules = ['color']

const handleError = (phase, error) => {
	console.error(`✗ Error on ${phase}:`)
	console.error(`  Message: ${error.message}`)
	if (error.stack) {
		console.error(`  Stack: ${error.stack}`)
	}
	if (error.sassError) {
		console.error(`  Error SASS: ${error.sassError}`)
		console.error(`  In: ${error.file}:${error.line}:${error.column}`)
	}
}

export default defineConfig({
	publicDir: false,

	server: {
		fs: {
			deny: ['.env', 'secret-folder', 'config.js'],
		},
	},

	css: {
		preprocessorOptions: {
			scss: {
				sourceMap: true,
			},
		},
		devSourcemap: true,
	},

	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,

		rollupOptions: {
			input: {
				main: resolve(__dirname, 'sass/main.scss'),
				...Object.fromEntries(modules.map((module) => [module, resolve(__dirname, `sass/${module}.scss`)])),
			},

			output: {
				entryFileNames: '[name].js',
				assetFileNames: (assetInfo) => {
					const info = assetInfo.name.split('.')
					const name = info[0]
					const ext = info[info.length - 1]

					if (ext === 'css') {
						return name === 'main' ? 'main.css' : `module/[name].css`
					}

					return `assets/[name].[ext]`
				},
			},
		},
		minify: false,
	},

	plugins: [
		{
			/**
			 * Order all plugins module
			 */
			name: 'coordinate-build-process',
			closeBundle: async () => {
				try {
					// Plugin: Create all css files
					await createScssPlugin(modules)

					// Criar versão minificada
					await createMinifiedCss()

					console.log('✓ Build process completed successfully')
				} catch (error) {
					handleError('build process', error)
				}
			},
		},
	],
})

/**
 * Compile all scss file with sourceMap
 */
const createScssPlugin = async (modules) => {
	try {
		for (const name of modules) {
			const filePath = resolve(__dirname, `sass/${name}.scss`)
			const result = sass.compile(filePath, {
				sourceMap: true,
				style: 'expanded',
				outFile: `${name}.css`,
			})

			const cssOut = resolve(__dirname, `dist/module/${name}.css`)
			const mapOut = resolve(__dirname, `dist/module/${name}.css.map`)

			await fs.writeFile(cssOut, result.css)
			await fs.writeFile(mapOut, JSON.stringify(result.sourceMap))
		}

		console.log('✓ Compiled SCSS modules with source maps')
	} catch (error) {
		handleError('scss build', error)
	}
}

/**
 * Plugin for creating the minify version of main.css
 */
const createMinifiedCss = async () => {
	try {
		const { default: CleanCSS } = await import('clean-css')
		const mainCssPath = resolve(__dirname, 'dist/main.css')
		const cssContent = await fs.readFile(mainCssPath, 'utf-8')
		const minifier = new CleanCSS({
			level: 2,
			sourceMap: true,
		})

		const minified = minifier.minify(cssContent)
		await fs.writeFile(resolve(__dirname, 'dist/main.min.css'), minified.styles, 'utf-8')
		await fs.writeFile(resolve(__dirname, 'dist/main.min.css.map'), minified.sourceMap.toString(), 'utf-8')

		console.log('✓ Generated minified version: main.min.css')
	} catch (error) {
		handleError('create minified css', error)
		throw error
	}
}
