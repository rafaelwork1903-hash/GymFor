// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// expo-sqlite en web: el .wasm de wa-sqlite se emite como asset estático.
config.resolver.assetExts.push('wasm')

// expo-sqlite en web usa SharedArrayBuffer (worker wa-sqlite), que solo está
// disponible con aislamiento de origen cruzado: cabeceras COOP/COEP.
// (Aplica al dev server; para hosting, configurar las mismas cabeceras allí.)
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    middleware(req, res, next)
  }
}

module.exports = config
