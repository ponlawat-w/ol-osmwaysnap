import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  mode: 'production',
  entry: './dist/index.js',
  module: {
    rules: [{
      test: /\.(js)$/,
      resolve: {
        fullySpecified: false
      }
    }]
  },
  resolve: {
    alias: { ol: false }
  },
  externalsType: 'var',
  externals: {
    'ol': 'ol',
    'ol/extent': 'ol.extent',
    'ol/Feature': 'ol.Feature',
    'ol/geom': 'ol.geom',
    'ol/interaction': 'ol.interaction',
    'ol/layer': 'ol.layer',
    'ol/loadingstrategy': 'ol.loadingstrategy',
    'ol/proj': 'ol.proj',
    'ol/source': 'ol.source',
    'ol/style': 'ol.style',
    'ol/style/Style': 'ol.style.Style',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'bundle'),
    filename: 'index.js',
    library: {
      type: 'var',
      name: 'OSMWaySnap'
    }
  },
};
