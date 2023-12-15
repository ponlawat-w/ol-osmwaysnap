import { Feature, MapBrowserEvent } from 'ol';
import { LineString } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import EventType from 'ol/MapBrowserEventType'
import { MouseEvent } from 'happy-dom';
import type { Map } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type { OSMWaySnap } from '../src';

/**
 * Drawing a linestring network that looks more or less like this:
 *
 *    │     => fLoopExtended
 *  ┌─┴─┐   => fLoop
 *  │   │   => fLoop
 *  └─┬─┘   => fCenterToBeforeLoop
 *  ──┼──   => fCenterTurnLeft / fCenterTurnRight
 *    │     => fDownToCenter
 *    │     => fDownToCenter
 * @returns vector source
 */
export const getDefaultWaySource = (): VectorSource<Feature<LineString>> => {
  const fDownToCenter = new Feature<LineString>(new LineString([
    [0, -50],
    [0, 0]
  ]));
  const fCenterTurnLeft = new Feature<LineString>(new LineString([
    [0, 0],
    [-25, 25],
    [-50, 25]
  ]));
  const fCenterToBeforeLoop = new Feature<LineString>(new LineString([
    [0, 0],
    [0, 10]
  ]));
  const fLoop = new Feature<LineString>(new LineString([
    [0, 10],
    [-10, 10],
    [-10, 20],
    [0, 20],
    [10, 20],
    [10, 10],
    [0, 10]
  ]));
  const fLoopExtended = new Feature<LineString>(new LineString([
    [0, 20],
    [0, 30]
  ]));
  const fCenterTurnRight = new Feature<LineString>(new LineString([
    [0, 0],
    [25, 25],
    [50, 25]
  ]));

  fDownToCenter.setId('fDownToCenter');
  fCenterTurnLeft.setId('fCenterTurnLeft');
  fCenterToBeforeLoop.setId('fCenterToBeforeLoop');
  fLoop.setId('fLoop');
  fLoopExtended.setId('fLoopExtended');
  fCenterTurnRight.setId('fCenterTurnRight');

  const features: Feature<LineString>[] = [
    fDownToCenter,
    fCenterTurnLeft,
    fCenterToBeforeLoop,
    fLoop,
    fLoopExtended,
    fCenterTurnRight
  ];

  return new VectorSource<Feature<LineString>>({ features });
};

export const mouseMove = (map: Map, interaction: OSMWaySnap, targetCoordinate: Coordinate) => {
  const event = new MapBrowserEvent(
    EventType.POINTERMOVE,
    map,
    new MouseEvent('mousemove') as any
  );
  event.coordinate = targetCoordinate;
  interaction.handleEvent(event);
};

export const mouseClick = (map: Map, interaction: OSMWaySnap, targetCoordinate: Coordinate) => {
  const event = new MapBrowserEvent(
    EventType.CLICK,
    map,
    new MouseEvent('click') as any
  );
  event.coordinate = targetCoordinate;
  interaction.handleEvent(event);
};
