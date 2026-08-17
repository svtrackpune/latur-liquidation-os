const fs = require('fs');
const path = require('path');

/**
 * Plesk/Windows can expose the same physical project path with different
 * casing (for example C:\\Inetpub vs C:\\inetpub). Webpack treats those as
 * different module identifiers, which can result in duplicate React/Next
 * instances and hook failures such as useContext(null).
 */
const projectRoot = fs.realpathSync(process.cwd());
const nodeModules = path.join(projectRoot, 'node_modules');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.join(nodeModules, 'react'),
      'react/jsx-runtime': path.join(nodeModules, 'react', 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(nodeModules, 'react', 'jsx-dev-runtime.js'),
      'react-dom': path.join(nodeModules, 'react-dom'),
      'react-dom/client': path.join(nodeModules, 'react-dom', 'client.js'),
      'react-dom/server': path.join(nodeModules, 'react-dom', 'server.js'),
    };
    return config;
  },
};

module.exports = nextConfig;
