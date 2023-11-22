import type { Extent } from 'ol/extent';
import type { OverpassResponse } from './response';

/**
 * Exception for not specifying OverpassAPI endpoint
 */
class OverpassAPIEndpointURLUnsetError extends Error {
  public constructor() {
    const msg = 'No endpoint URL for Overpass API specified for static property endpointURL of class OverpassAPI.'
      + ' Please specify one from https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances';
    console.error(msg);
    super(msg);
  }
}

/**
 * OverpassAPI fetcher
 */
export default class OverpassAPI {
  /**
   * Default endpoint URL for all queries if not specified in each call.
   * Public instances can be found in https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
   */
  public static endpointURL: string|undefined = undefined;

  private constructor() {}

  /**
   * Fetch data from OverpassAPI
   * @param settings OverpassQL settings statement
   * @param query OverpassQL query statement(s)
   * @param out OverpassQL out statement
   * @param endpoint OverpassAPI endpoint URL
   * @returns Promise of OverpassAPI response object
   */
  public static async fetch(
    settings: string,
    query: string,
    out?: string,
    endpoint?: string
  ): Promise<OverpassResponse> {
    if (!endpoint && !OverpassAPI.endpointURL) {
      throw new OverpassAPIEndpointURLUnsetError();
    }

    out = out ?? 'out;';

    const body = new URLSearchParams({ data: settings + query + out }).toString();
    const result = await fetch(
      endpoint ?? OverpassAPI.endpointURL!,
      { method: 'POST', body }
    );

    return (await result.json());
  }

  /**
   * Convert OpenLayers extent into OverpassQL bbox setting statement
   * @param extent OpenLayers extent
   * @returns OverpassQL bbox setting statement
   */
  public static extentToBBox(extent: Extent): string {
    return '[bbox:' + [
      Math.min(extent[1], extent[3]),
      Math.min(extent[0], extent[2]),
      Math.max(extent[1], extent[3]),
      Math.max(extent[0], extent[2])
    ].join(',') + ']';
  }

  /**
   * Create setting statements from OpenLayers extent and fetch data specified in query from OverpassAPI
   * @param extent OpenLayers Extent
   * @param query OverpassQL query statement
   * @param out OverpassQL out statement
   * @param endpoint OverpassAPI endpoint URL
   * @returns Promise of OverpassAPI response object
   */
  public static async fetchInExtent(
    extent: Extent,
    query: string,
    out: string = 'out;',
    endpoint?: string
  ): Promise<OverpassResponse> {
    const settings = OverpassAPI.extentToBBox(extent) + '[out:json];';
    return OverpassAPI.fetch(settings, query, out, endpoint);
  }
};
