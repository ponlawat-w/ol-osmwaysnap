import { LineString } from 'ol/geom';
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
   * Given a loop linestring with a number of coordinates of `length`, travel with increasing index from `fromIdx` until `toIdx` inclusively,
   *  return the array of indices visited in the travel.
   * Example:
   *  length = 5, fromIdx = 1, toIdx = 3, return [1, 2, 3];
   *  length = 6, fromIdx = 4, toIdx = 3, return [4, 5, 0, 1, 2, 3];
   * @param length Coordinates count of a loop linestring
   * @param fromIdx Index to travel from
   * @param toIdx Index to travel to (inclusive)
   * @returns Array of indices traveled
   */
  private static getLoopTravelIndices(length: number, fromIdx: number, toIdx: number): number[] {
    if (fromIdx < toIdx) return Array(toIdx - fromIdx + 1).fill(-1).map((_, i) => fromIdx + i);
    return [
      ...Array(length - fromIdx).fill(-1).map((_, i) => fromIdx + i),
      ...Array(toIdx).fill(-1).map((_, i) => i + 1)
    ];
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

  /**
   * Given a loop `lineString`, return partial coordinates of the loop traveling from coordinate at index `fromIdx` to `toIdx` inclusively,
   *  in either original or reverted vertex direction depending on which one gives a shorter distance.
   * @param lineString Loop linestring (with the first and the last coordinate is the same)
   * @param fromIdx Traveling from index
   * @param toIdx Traveling until index
   * @returns Array of coordinate that travels from `fromIdx` to `toIdx` on the given linestring in the direction of whether
   *  clockwise or counter-clockwise depends on which gives a shorter length
   */
  public static getShorterPathOnLoop(lineString: LineString, fromIdx: number, toIdx: number): Coordinate[] {
    if (fromIdx === toIdx) return [];

    const forwardCoorsIndices = LineStringUtils.getLoopTravelIndices(lineString.getCoordinates().length, fromIdx, toIdx);
    const revertedCoorsIndices = LineStringUtils.getLoopTravelIndices(lineString.getCoordinates().length, toIdx, fromIdx).reverse();

    const forwardLineString = new LineString(forwardCoorsIndices.map(i => lineString.getCoordinates()[i]));
    const revertedLineString = new LineString(revertedCoorsIndices.map(i => lineString.getCoordinates()[i]));
    return (forwardLineString.getLength() < revertedLineString.getLength() ? forwardLineString : revertedLineString)
      .getCoordinates().map(c => [...c]);
  }
};
