import LineString from 'ol/geom/LineString';
import type { Coordinate } from 'ol/coordinate';

/**
 * Static class for LineString calculation utilities
 */
export default class LineStringUtils {
  private constructor() {}

  /**
   * Given a linestring and a coordinate, if the coordinate lies on the linestring then return the index of coordinates that contains the coordinate,
   *  otherwise -1 when the coordinate does not lie on the linestring
   * @param lineString LineString geometry
   * @param coordinate Coordinate to split
   * @returns index of coordinate on linestring, before which contains the given coordinate, -1 if the coordinate does not lie on the linestring
   */
  private static getSplitIndex(lineString: LineString, coordinate: Coordinate): number {
    const coordinates = lineString.getCoordinates();
    if (coordinates[0][0] === coordinate[0] && coordinates[0][1] === coordinate[1]) return -1;
    for (let i = 1; i < coordinates.length; i++) {
      if (coordinates[i][0] === coordinate[0] && coordinates[i][1] === coordinate[1]) return -1;
      if (new LineString([coordinates[i - 1], coordinates[i]]).intersectsCoordinate(coordinate)) return i;
    }
    return -1;
  }

  /**
   * Given a linestring and a coordinate that lies on the linestring but not in the vertex coordinates set of the linestring,
   *  split the linestring to include that coordinate.
   * If the coordinate does not lie on the linestring, then return the original input as is.
   * @param lineString LineString geometry
   * @param coordinate Coordinate to split
   * @returns New linestring that contains the given spliting coordinate
   */
  public static split(lineString: LineString, coordinate: Coordinate): LineString {
    const idx = LineStringUtils.getSplitIndex(lineString, coordinate);
    if (idx < 0) return lineString;

    const coordinates = lineString.getCoordinates();
    return new LineString([
      ...coordinates.slice(0, idx),
      coordinate,
      ...coordinates.slice(idx)
    ]);
  }
};
