# OpenLayers OSMWaySnap

[OpenLayers](https://openlayers.org/) extension for drawing line string with snapping to way elements from [OpenStreetMap](https://wiki.openstreetmap.org/wiki/About_OpenStreetMap) using [OverpassAPI](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Instructions

```bash
npm install ol-osmwaysnap
```

Create an instance of class `OSMWaySnap` and add it to map. (Default snapping to OSM roads)

```ts
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { OSMWaySnap } from 'ol-osmwaysnap';

const targetLayer = new VectorLayer<VectorSource<Feature<LineString>>>({
  source: new VectorSource<Feature<LineString>>()
});
map.addLayer(targetLayer);

// Default: Snap to roads (OSM highway)
const interaction = new OSMWaySnap({
  source: targetLayer.getSource(),
  maximumResolution: 5,
  fetchBufferSize: 250,
  overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
});
map.addInteraction(interaction);
```

Or specify a custom OverpassQL for different way elements, for example to railways.

```ts
// Snap to railways
const interaction = new OSMWaySnap({
  source: targetLayer.getSource(),
  maximumResolution: 5,
  fetchBufferSize: 250,
  overpassQuery: '(way["railway"];>;);',
  overpassEndpointURL: 'https://...' // Choose one instance from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
});
map.addInteraction(interaction);
```

Or use a custom vector source (not OSM) for snapping.

```ts
const interaction = new OSMWaySnap({
  source: targetLayer.getSource(),
  waySource: someVectorSource
  maximumResolution: 5,
  fetchBufferSize: 250
});
map.addInteraction(interaction);
```

## Examples
TODO

## Constructor Options

### For `OSMWaySnap`

- `autoFocus?: boolean` - True to automatically fit map view to next candidantes. (default: true)
- `focusPadding?: number` - Used with autoFocus, specify number to add padding to view fitting. (default: 50 !PROJECTION SENSITIVE!)
- `sketchStyle?: StyleLike` - Style of sketch features (default is predefined, overwrite if necessary)
- `source: VectorSource<Feature<LineString>>` - Target source of edition
- `waySource?: VectorSource<Feature<LineString>>` - Ways source for snapping (default to a new instance of OSMOverpassWaySource)
- `createAndAddWayLayer?: boolean` - Create a new way layer from way source (if provided) and add to map (default: true)
- `wrapX?: boolean` - WrapX

### extended options if `waySource` is not provided

- `cachedFeaturesCount: number` - The number of features to store before getting cleared. This is to prevent heavy memory consumption.
- `fetchBufferSize: number` - Buffer size to apply to the extent of fetching OverpassAPI. This is to prevent excessive call despite slight map view panning. **USE THE SAME PROJECTION WITH THE LAYER**.
- `maximumResolution: number` - Map view resolution to start fetching OverpassAPI. This is to prevent fetching elements in too big extent. **USE THE SAME PROJECTION WITH THE LAYER**
- `overpassQuery: string` - OverpassQL statement(s) to fetch, excluding settings and out statements.
- `overpassEndpointURL?: string` - OverpassAPI endpoint URL (https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)

---
