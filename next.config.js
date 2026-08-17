const fs = require('fs');
const path = require('path');

/**
 * Plesk on Windows can expose the same physical path with different drive/path
 * casing (for example C:\\Inetpub vs C:\\inetpub). Webpack then treats the
 * same React/Next modules as separate module identifiers during production
 * builds, which can cause React hook failures such as useContext(null).
 * Resolve React from one canonical real path to keep a single React instance.
 */
const projectRoot = fs.realpathSync(process.cwd());
const nodeModules = path.join(projectRoot, 'node_modules');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.join(nodeModules, 'react'),
      'react-dom': path.join(nodeModules, 'react-dom'),
    };
    return config;
  },
};

module.exports = nextConfig;
