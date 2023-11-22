// Type definition of OverpassAPI response with out:json settings

export type OSMElementBase = {
  type: 'node'|'way'|'relation',
  id: number,
  tags: { name?: string } & Record<string, string>
};

export type OSMNode = OSMElementBase & {
  type: 'node',
  lat: number,
  lon: number,
};

export type OSMWay = OSMElementBase & {
  type: 'way',
  nodes: number[]
};

export type OSMElement = OSMNode | OSMWay;

export type OverpassResponse = {
  version: number,
  generator: string,
  elements: OSMElement[],
  osm3s: {
    timestamp_osm_base: string,
    copyright: string
  }
};
