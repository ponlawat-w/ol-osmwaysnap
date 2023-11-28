import Event from 'ol/events/Event';
import type { Feature } from 'ol';
import type { ObjectEvent } from 'ol/Object';
import type { Types as ObjectEventTypes } from 'ol/ObjectEventType';
import type { CombinedOnSignature, EventTypes as ObservableEventTypes, OnSignature } from 'ol/Observable';
import type { LineString } from 'ol/geom';

/**
 * Event type for OSMWaySnapInteraction
 */
export const OSMWaySnapEventType = {
  /** Event when OSMWaySnap interaction starts on a feature whether creation or edition. */
  WAYSNAPSTART: 'waysnapstart',

  /** Event when OSMWaySnap interaction has created a new feature. */
  WAYSNAPSTARTCREATE: 'waysnapstartcreate',

  /** Event when OSMWaySnap has started edition an existing feature. */
  WAYSNAPSTARTEDIT: 'waysnapstartedit',

  /** Event when OSMWaySnap has updated the active feature. */
  WAYSNAPUPDATE: 'waysnapupdate',

  /** Event when OSMWaySnap has finished. */
  WAYSNAPEND: 'waysnapend'
} as const;

type OSMWaySnapEventType = typeof OSMWaySnapEventType[keyof typeof OSMWaySnapEventType];

/**
 * Event for OSMWaySnap interaction
 */
export class OSMWaySnapEvent extends Event {
  /** Active feature for the event */
  private _feature: Feature<LineString>;

  /** Active feature for the event */
  public get feature(): Feature<LineString> { return this._feature };

  /**
   * Constructor
   * @param type Type of event
   * @param feature Active feature for the event
   */
  constructor(type: OSMWaySnapEventType, feature: Feature<LineString>) {
    super(type);
    this._feature = feature;
  }
}

/** Type signature for OSMWaySnap interaction event dispatcher */
export type OSMWaySnapOnSignature<Return> = OnSignature<ObservableEventTypes, Event, Return>
  & OnSignature<ObjectEventTypes|'change:active', ObjectEvent, Return>
  & OnSignature<OSMWaySnapEventType, OSMWaySnapEvent, Return>
  & CombinedOnSignature<ObservableEventTypes|ObjectEventTypes|'change:active'|OSMWaySnapEventType, Return>;
