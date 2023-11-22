import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import OverpassAPI from './overpass-api';
import { transform, transformExtent } from 'ol/proj';
import type { Extent } from 'ol/extent';
import type { OSMNode, OSMWay } from './response';
import type { Projection } from 'ol/proj';

/**
 * OSM way elements fetcher from Overpass API
*/
export default class OSMWays {
  private constructor() {}

  /**
   * Fetch ways from OSM in the specified extent and query, transform to geometric objects of linestring and return the array of them
   * @param extent fetch extent
   * @param query OverpassQL for querying ways (excluding settings and out statements)
   * @param projection Projection
   * @param endpoint URL endpoint, if specify it will overwrite the static settings in OverpassAPI class
   * @returns Promise of linestring features array
   */
  public static async fetch(extent: Extent, query: string, projection: Projection, endpoint?: string): Promise<Feature<LineString>[]> {
    if (projection.getCode() !== 'EPSG:4326') {
      extent = transformExtent(extent, projection, 'EPSG:4326');
    }

    const response = await OverpassAPI.fetchInExtent(extent, query, 'out;', endpoint);

    const nodes: { [id: number]: OSMNode } = (response.elements.filter(x => x.type === 'node') as OSMNode[])
      .reduce((dict, node: OSMNode) => {
        dict[node.id] = node;
        return dict;
      }, {} as { [id: number]: OSMNode });
    
    return (response.elements.filter(x => x.type === 'way') as OSMWay[])
      .map(x => {
        const coordinates = projection.getCode() === 'EPSG:4326' ?
          x.nodes.map(id => [nodes[id].lon, nodes[id].lat])
          : x.nodes.map(id => transform([nodes[id].lon, nodes[id].lat], 'EPSG:4326', projection));
        const feature = new Feature<LineString>(new LineString(coordinates));
        feature.setProperties({
          osmid: x.id,
          name: x.tags.name ?? undefined
        });
        feature.setId(x.id);
        return feature;
      });
  }
};
