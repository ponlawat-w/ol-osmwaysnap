import { expect, test } from 'vitest';
import VectorSource from 'ol/source/Vector';
import { OSMWaySnap } from '../src';
import { OSMOverpassWaySource } from 'ol-osmoverpass';
import type Feature from 'ol/Feature';
import type LineString from 'ol/geom/LineString';

test('Test default initialisation with OSMOverpass', () => {
  const osmWaySnap = new OSMWaySnap({
    source: new VectorSource<Feature<LineString>>(),
    maximumResolution: 5,
    fetchBufferSize: 250,
    overpassEndpointURL: 'https://overpass-api.de/api/interpreter'
  });

  expect(osmWaySnap.getWaySource()).toBeInstanceOf(OSMOverpassWaySource);
});
