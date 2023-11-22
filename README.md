# OpenLayers OSMWaySnap

[OpenLayers](https://openlayers.org/) extension for drawing line string with snapping to way elements from [OpenStreetMap](https://wiki.openstreetmap.org/wiki/About_OpenStreetMap) using [OverpassAPI](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Instructions

This extension is an interaction type in OpenLayers which requires a few setup steps:

### 1. Vector layer for OSM ways

To begin with, it is necessary to setup a vector layer that contains OSM ways. Using builtin `OSMWaySource` class that automatically fetches ways from OpenStreetMap using OverpassAPI, or alternatively, it can also be used with other linestring feature layer.

```ts
import VectorLayer from 'ol/layer/Vector';
import { OSMWaySource } from 'ol-osmwaysnap';

// Default: Snap to roads (OSM highway)
const osmWayLayer = new VectorLayer({
  source: new OSMWaySource({
    maximumResolution: 5,
    fetchBufferSize: 250,
    overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
  }),
  style: OSMWaySource.getDefaultStyle()
});

// Snap to railways
const osmWayLayer = new VectorLayer({
  source: new OSMWaySource({
    maximumResolution: 5,
    fetchBufferSize: 250,
    overpassQuery: '(way["railway"];>;);',
    overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
  }),
  style: OSMWaySource.getDefaultStyle()
});
```

### 2. Add interactions

There are at least 2 interactions to be added in order for the extension to work 1) `OSMWaySnap` and 2) `Snap` interaction from default OpenLayers interactions.

```ts
import { OSMWaySnap } from 'ol-osmwaysnap';
import Snap from 'ol/interaction/Snap';

map.addInteraction(new OSMWaySnap({
  source: targetFeatureLayer.getSource(),
  waySource: osmWayLayer.getSource()
}));
map.addInteraction(new Snap({
  source: osmWayLayer.getSource()
}));
```

## Examples

### Using as module

```ts
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Snap from 'ol/interaction/Snap';
import LineString from 'ol/geom/LineString';
import Feature from 'ol/Feature';
import { OSMWaySource, OSMWaySnap } from 'ol-osmwaysnap';

const basemap = new TileLayer({ source: new OSM() });

const osmWaySource = new OSMWaySource({
  maximumResolution: 5,
  fetchBufferSize: 250,
  overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
});

const targetFeaturesLayer = new VectorLayer<VectorSource<Feature<LineString>>>({
  source: new VectorSource<Feature<LineString>>()
});
const osmWayLayer = new VectorLayer({source: osmWaySource, style: OSMWaySource.getDefaultStyle()});

const map = new Map({
  target: 'map',
  layers: [basemap, osmWayLayer, targetFeaturesLayer],
  view: new View({
    center: [11018989, 2130015],
    zoom: 16
  })
});

map.addInteraction(new OSMWaySnap({
  source: targetFeaturesLayer.getSource()!,
  waySource: osmWayLayer.getSource()!
}));
map.addInteraction(new Snap({
  source: osmWayLayer.getSource()!
}));
```

### Using as CDN

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v8.2.0/ol.css">
    <style>
      #map {
        width: 100%;
        height: 90vh;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="status"></div>
    <script src="https://cdn.jsdelivr.net/npm/ol@v8.2.0/dist/ol.js"></script>
    <script src="https://www.unpkg.com/ol-osmwaysnap/dist/webpack/index.js"></script>
    <script lang="js">
      const basemap = new ol.layer.Tile({ source: new ol.source.OSM() });

      const targetFeaturesLayer = new ol.layer.Vector({
        source: new ol.source.Vector()
      });

      const osmWayLayer = new ol.layer.Vector({
        source: new OSMWaySnap.OSMWaySource({
          maximumResolution: 5,
          fetchBufferSize: 250,
          overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
        }),
        style: OSMWaySnap.OSMWaySource.getDefaultStyle()
      });

      osmWayLayer.getSource().on('featuresloadstart', () => {
        document.getElementById('status').innerHTML = 'Loading…';
      });
      osmWayLayer.getSource().on('featuresloadend', () => {
        document.getElementById('status').innerHTML = '';
      });
      osmWayLayer.getSource().on('featuresloaderror', () => {
        document.getElementById('status').innerHTML = 'ERROR';
      });

      const map = new ol.Map({
        target: 'map',
        layers: [basemap, osmWayLayer, targetFeaturesLayer],
        view: new ol.View({
          center: [11018989, 2130015],
          zoom: 16
        })
      });

      map.addInteraction(new OSMWaySnap.OSMWaySnap({
        source: targetFeaturesLayer.getSource(),
        waySource: osmWayLayer.getSource()
      }));
      map.addInteraction(new ol.interaction.Snap({
        source: osmWayLayer.getSource()
      }));
    </script>
  </body>
</html>
```

## Options

### `OSMWaySource` constructor options

- `cachedFeaturesCount: number` - The number of features to store before getting cleared. This is to prevent heavy memory consumption.
- `fetchBufferSize: number` - Buffer size to apply to the extent of fetching OverpassAPI. This is to prevent excessive call despite slight map view panning. **USE THE SAME PROJECTION WITH THE LAYER**.
- `maximumResolution: number` - Map view resolution to start fetching OverpassAPI. This is to prevent fetching elements in too big extent. **USE THE SAME PROJECTION WITH THE LAYER**
- `overpassEndpointURL?: string` - OverpassAPI endpoint URL (https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)
- `overpassQuery: string` - OverpassQL statement for ways to fetch, default to OSM highways.

### `OSMWaySnap` constructor options

- `autoFocus?: boolean` - True to automatically fit map view to next candidantes.
- `focusPadding?: number` - Used with autoFocus, specify number to add padding to view fitting.
- `sketchStyle?: StyleLike` - Style of sketch features.
- `source: VectorSource<Feature<LineString>>` - Target source of edition.
- `waySource: VectorSource<Feature<LineString>>` - Source to OSMWays for snapping.
- `wrapX?: boolean`

---
