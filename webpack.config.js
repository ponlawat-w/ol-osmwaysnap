const path = require('path');

module.exports = {
  mode: 'production',
  entry: './dist/index.js',
  resolve: {
    alias: { ol: false }
  },
  externalsType: 'var',
  externals: {
    'ol/extent': 'ol.extent',
    'ol/Feature': 'ol.Feature',
    'ol/geom/LineString': 'ol.geom.LineString',
    'ol/geom/MultiPoint': 'ol.geom.MultiPoint',
    'ol/geom/Point': 'ol.geom.Point',
    'ol/interaction/Pointer': 'ol.interaction.Pointer',
    'ol/interaction/Property': 'ol.interaction.Property',
    'ol/layer/Vector': 'ol.layer.Vector',
    'ol/loadingstrategy': 'ol.loadingstrategy',
    'ol/Map': 'ol.Map',
    'ol/proj': 'ol.proj',
    'ol/source/Vector': 'ol.source.Vector',
    'ol/style/Circle': 'ol.style.Circle',
    'ol/style/Fill': 'ol.style.Fill',
    'ol/style/Stroke': 'ol.style.Stroke',
    'ol/style/Style': 'ol.style.Style'
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'webpack'),
    filename: 'index.js',
    library: {
      type: 'var',
      name: 'OSMWaySnap'
    }
  },
};
