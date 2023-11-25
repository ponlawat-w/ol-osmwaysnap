import { Map } from 'ol';
import { boundingExtent } from 'ol/extent';
import Feature from 'ol/Feature';
import { Point, LineString } from 'ol/geom';
import { Snap, Pointer as PointerInteraction } from 'ol/interaction';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Circle, Fill, Stroke } from 'ol/style';
import Style, { createEditingStyle } from 'ol/style/Style';
import { OSMOverpassWaySource, type OSMOverpassSourceOptions } from 'ol-osmoverpass';
import LineStringUtils from './line-string-utils';
import type { Coordinate } from 'ol/coordinate';
import type { StyleLike } from 'ol/style/Style';
import type { MapBrowserEvent } from 'ol';

/** Options for OSMWaySnap interaction */
type SnapOptions = {
  /** True to automatically fit map view to next candidantes. (default: true) */
  autoFocus?: boolean,

  /** Used with autoFocus, specify number to add padding to view fitting. (default: 50 !PROJECTION SENSITIVE!) */
  focusPadding?: number,

  /** Style of sketch features (default is predefined, overwrite if necessary) */
  sketchStyle?: StyleLike,

  /** Target source of edition */
  source: VectorSource<Feature<LineString>>,

  /** Ways source for snapping (default to a new instance of OSMOverpassWaySource) */
  waySource: VectorSource<Feature<LineString>>,

  /** Create a new way layer from way source (if provided) and add to map (default: true) */
  createAndAddWayLayer?: boolean,

  /** WrapX */
  wrapX?: boolean
};

type SnapOptionsOSMOverpassWaySource = Omit<SnapOptions, 'waySource'> & {
  waySource?: undefined
} & Partial<OSMOverpassSourceOptions>;

export type OSMWaySnapOptions = SnapOptions | SnapOptionsOSMOverpassWaySource;

/**
 * Interaction for snapping linestring to way elements from OSM
 * This is designed to use with Snap interaction.
 */
export default class OSMWaySnap extends PointerInteraction {
  /** Coordinates of active linestring */
  private coordinates: Coordinate[] = [];
  /** Feature that is being edited */
  private activeFeature?: Feature<LineString> = undefined;

  /** Sketch layer that is placed overlay the map */
  private overlayLayer: VectorLayer<VectorSource>;
  /** Sketch point for placeholder on map */
  private sketchPoint?: Feature<Point> = undefined;
  /** Sketch point for placeholder on map */
  private sketchLine?: Feature<LineString> = undefined;
  /** Candidate points for selection on map */
  private candidatePoints: Feature<Point>[] = [];
  /** Candidate lines for selection on map */
  private candidateLines: Feature<LineString>[] = [];

  /** True to automatically fit map view to next candidantes. */
  private autoFocus: boolean;
  /** Used with autoFocus, specify number to add padding to view fitting. */
  private focusPadding: number;
  /** Target source of edition */
  private source: VectorSource<Feature<LineString>>;
  /** Ways source for snapping */
  private waySource: VectorSource<Feature<LineString>>;
  /** Create a new way layer from way source (if provided) and add to map */
  private createAndAddWayLayer: boolean;
  /** WrapX */
  private wrapX: boolean|undefined = undefined;

  /** Map */
  private map: Map|undefined = undefined;

  /** Layer of snapping ways */
  private wayLayer: VectorLayer<VectorSource<Feature<LineString>>>|undefined = undefined;
  /** Snap interaction */
  private snapInteraction: Snap;

  /**
   * Constructor
   * @param options Options
   */
  public constructor(options: OSMWaySnapOptions) {
    super();
    this.autoFocus = options.autoFocus === undefined ? true: options.autoFocus;
    this.focusPadding = options.focusPadding ?? 50;
    this.source = options.source;
    this.waySource = options.waySource ?? new OSMOverpassWaySource({
      cachedFeaturesCount: options.cachedFeaturesCount ?? undefined,
      fetchBufferSize: options.fetchBufferSize ?? undefined,
      maximumResolution: options.maximumResolution ?? undefined,
      overpassQuery: options.overpassQuery ?? '(way["highway"];>;);',
      overpassEndpointURL: options.overpassEndpointURL ?? undefined
    });
    this.createAndAddWayLayer = options.createAndAddWayLayer === undefined ? true : options.createAndAddWayLayer;
    this.wrapX = options.wrapX;
    this.snapInteraction = new Snap({ source: this.waySource });

    if (this.createAndAddWayLayer) {
      this.wayLayer = new VectorLayer({ source: this.waySource, style: OSMOverpassWaySource.getDefaultStyle() });
    }
    this.overlayLayer = new VectorLayer({
      source: new VectorSource({ useSpatialIndex: false, wrapX: this.wrapX }),
      updateWhileInteracting: true,
      style: options.sketchStyle ?? OSMWaySnap.getDefaultSketchStyle()
    });

    this.addChangeListener('active', this.activeChanged.bind(this));
  }

  /**
   * Remove the interaction from its current map and attach it to the new map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param map Map.
   */
  public setMap(map: Map|null) {
    if (this.map) {
      this.waySource.un('featuresloadend', this.waysFeaturesLoadEnded.bind(this));
      this.wayLayer && this.map.removeLayer(this.wayLayer);
      this.map.removeLayer(this.overlayLayer);
      this.map.removeInteraction(this.snapInteraction);
    }
    super.setMap(map);
    this.map = map ?? undefined;
    if (this.map) {
      this.waySource.on('featuresloadend', this.waysFeaturesLoadEnded.bind(this));
      this.wayLayer && this.map.getAllLayers().indexOf(this.wayLayer) < 0 && this.map.addLayer(this.wayLayer);
      this.map.addLayer(this.overlayLayer);
      this.map.getInteractions().getArray().indexOf(this.snapInteraction) < 0 && this.map.addInteraction(this.snapInteraction);
    }
  }

  /**
   * Handler on active property changed.
   */
  public activeChanged() {
    this.setMap(this.getActive() ? (this.map ?? null) : null);
  }

  /**
   * Get way vector source
   */
  public getWaySource(): VectorSource<Feature<LineString>> {
    return this.waySource;
  }

  /**
   * Get active feature
   */
  public getActiveFeature(): Feature<LineString>|undefined {
    return this.activeFeature;
  }

  /** Called when the editing is finished, clear all the sketching and candidates. */
  public finishEditing() {
    this.activeFeature = undefined;
    this.coordinates = [];
    this.removeSketchPoint();
    this.removeSketchLine();
    this.removeCandidateLines();
    this.removeCandidatePoints();
  }

  /**
   * Check if mouse is clicked (otherwise use default behaviours),
   *  when there is no active feature then create a new feature with the first vertex being the clicked coordinate,
   *  when the feature is already started, then append the coordinates from the sketch line,
   *  but if the last vertex is clicked, then finalise the editing.
   * @param event Event
   */
  public handleEvent(event: MapBrowserEvent<MouseEvent>): boolean {
    if (event.type !== 'click') return super.handleEvent(event);
    if (!this.coordinates.length) {
      this.coordinates = [this.sketchPoint?.getGeometry()!.getCoordinates() ?? event.coordinate];
      this.updateFeature();
      return false;
    }
    const lastCoors = this.activeFeature!.getGeometry()!.getLastCoordinate();
    if (lastCoors[0] === event.coordinate[0] && lastCoors[1] === event.coordinate[1]) {
      this.finishEditing();
      return false;
    }
    if (this.sketchLine) {
      this.coordinates.push(...this.sketchLine.getGeometry()!.getCoordinates().slice(1));
      this.updateFeature();
      return false;
    }
    return super.handleEvent(event);
  }

  /**
   * On mouse is moved, update the sketch point and line.
   * @param event Event
   */
  protected handleMoveEvent(event: MapBrowserEvent<MouseEvent>): void {
    this.createOrUpdateSketchPoint(event.coordinate);
    if (this.coordinates.length) {
      this.createOrUpdateSketchLine(event.coordinate);
    }
    return super.handleMoveEvent(event);
  }

  /**
   * Create or update active feature from editing coordinates.
   */
  private updateFeature() {
    if (!this.activeFeature) {
      this.activeFeature = new Feature<LineString>(new LineString(this.coordinates));
    } else {
      this.activeFeature.getGeometry()!.setCoordinates(this.coordinates);
      if (this.coordinates.length > 1 && !this.source.hasFeature(this.activeFeature)) {
        this.source.addFeature(this.activeFeature);
      }
    }
    this.calculateCandidates();
  }

  /**
   * Given a candidate linestring, return coordinate set from the tip of the active feature following that line until the cursor coordinate,
   *  or return an empty coordinate set if the candidate is not valid according to cursor position.
   * @param mouseCoor Coordinate of user cursor
   * @param candidate A candidate way linestring
   * @returns Coordinates set of sketch line
   */
  private getSketchLineCoordinates(mouseCoor: Coordinate, candidate: LineString): Coordinate[] {
    const candidateIsLoop: boolean = candidate.getFirstCoordinate()[0] === candidate.getLastCoordinate()[0]
      && candidate.getFirstCoordinate()[1] === candidate.getLastCoordinate()[1];

    const activeFeatureLastCoor = this.activeFeature!.getGeometry()!.getLastCoordinate();

    if (candidateIsLoop && activeFeatureLastCoor[0] === mouseCoor[0] && activeFeatureLastCoor[1] === mouseCoor[1]) {
      return [];
    }

    if (!candidate.getCoordinates().some(c => c[0] === activeFeatureLastCoor[0] && c[1] === activeFeatureLastCoor[1])) {
      candidate = LineStringUtils.split(candidate, activeFeatureLastCoor);
    }
    if (!candidate.getCoordinates().some(c => c[0] === mouseCoor[0] && c[1] === mouseCoor[1])) {
      candidate = LineStringUtils.split(candidate, mouseCoor);
    }

    const startIdx = candidate.getCoordinates().findIndex(c => c[0] === activeFeatureLastCoor[0] && c[1] === activeFeatureLastCoor[1]);
    if (startIdx < 0) return [];
    const endIdx = candidate.getCoordinates().findIndex(c => c[0] === mouseCoor[0] && c[1] === mouseCoor[1]);

    if (candidateIsLoop) return LineStringUtils.getShorterPathOnLoop(candidate, startIdx, endIdx);
    if (endIdx < 0) return [];
    if (endIdx === startIdx) return [];
    if (startIdx < endIdx) {
      return candidate.getCoordinates()
        .slice(startIdx, endIdx + 1)
        .map(c => [...c]);
    }
    return candidate.getCoordinates()
      .slice(endIdx, startIdx + 1)
      .reverse()
      .map(c => [...c]);
  }

  /**
   * Update the sketch layer displayed.
   */
  private updateSketchLayer() {
    const source = this.overlayLayer.getSource()!;
    source.clear(true);
    if (this.sketchLine) source.addFeature(this.sketchLine);
    source.addFeatures(this.candidateLines);
    source.addFeatures(this.candidatePoints);
    if (this.sketchPoint) source.addFeature(this.sketchPoint);
  }

  /**
   * Fit all candidate points, that are not included in the active feature, into map view.
   */
  private fitCandidatesToMapView() {
    if (!this.candidatePoints.length) return;
    const map = this.getMap();
    if (map) {
      const lastCoordinate = this.coordinates[this.coordinates.length - 1];
      const fitCoordinates = this.candidatePoints.map(p => p.getGeometry()!.getCoordinates())
        .filter(
          p => (lastCoordinate[0] === p[0] && lastCoordinate[1] === p[1])
            || !this.activeFeature!.getGeometry()!.intersectsCoordinate(p)
        );
      if (fitCoordinates.length > 1) {
        map.getView().fit(boundingExtent(fitCoordinates), {
          padding: Array(4).fill(this.focusPadding)
        });
      }
    }
  }

  /**
   * Calculate the candidate lines (the lines whose vertices are connected to the tip of active feature)
   *  and the candidate points (all the vertices on the candidate lines).
   * @param fit True to fit candidates to map after calculated, this is ineffective if options.autoFocus is false.
   */
  private calculateCandidates(fit: boolean = true) {
    const lastFeatureCoors = this.activeFeature!.getGeometry()!.getLastCoordinate();
    this.candidateLines = this.waySource.getFeatures().filter(
      feature => feature.getGeometry()!.containsXY(lastFeatureCoors[0], lastFeatureCoors[1])
    ).map(c => {
      const f = new Feature(c.getGeometry());
      f.setProperties({ candidate: true });
      f.setId(c.getId());
      return f;
    });
    this.candidatePoints = this.candidateLines.map(l => l.getGeometry()!.getCoordinates()).flat()
      .map(c => new Feature<Point>({ candidate: true, geometry: new Point(c) }));
    if (fit && this.autoFocus) {
      this.fitCandidatesToMapView();
    }
    this.createOrUpdateSketchLine(lastFeatureCoors);
  }

  /**
   * Create or move the sketch point to the specified coordinate
   * @param coordinate Coordinate
   */
  private createOrUpdateSketchPoint(coordinate: Coordinate) {
    if (this.sketchPoint) {
      this.sketchPoint.getGeometry()!.setCoordinates(coordinate);
    } else {
      this.sketchPoint = new Feature(new Point(coordinate));
    }
    this.updateSketchLayer();    
  }

  /**
   * Create or move the sketch line.
   *  The sketch line will always starts from the tip of the active feature,
   *  then if the coordinate is on any candidate line, the sketch line follows that line until the given coordinate,
   *  otherwise it draws a straight line from the tip of the active feature to the given coordinate.
   * @param coordinate Coordinate
   */
  private createOrUpdateSketchLine(coordinate: Coordinate) {
    const candidates = this.candidateLines.filter(
      feature => feature.getGeometry()!.containsXY(coordinate[0], coordinate[1])
    );
    let sketchCoors: Coordinate[] = candidates.length ? [] : [this.activeFeature!.getGeometry()!.getLastCoordinate(), coordinate];
    for (const candidate of candidates) {
      const candidateSketchCoors = this.getSketchLineCoordinates(coordinate, candidate.getGeometry()!);
      if (candidateSketchCoors.length) {
        sketchCoors = candidateSketchCoors;
        break;
      }
    }
    if (!sketchCoors.length) {
      return this.removeSketchLine();
    }

    if (this.sketchLine) {
      this.sketchLine.getGeometry()!.setCoordinates(sketchCoors);
    } else {
      this.sketchLine = new Feature(new LineString(sketchCoors));
    }
    this.updateSketchLayer();
  }

  /** Remove sketch point. */
  private removeSketchPoint() {
    if (!this.sketchPoint) return;
    this.sketchPoint = undefined;
    this.updateSketchLayer();
  }

  /** Remove sketch line. */
  private removeSketchLine() {
    if (!this.sketchLine) return;
    this.sketchLine = undefined;
    this.updateSketchLayer();
  }

  /** Remove all the candidate lines. */
  private removeCandidateLines() {
    this.candidateLines = [];
    this.updateSketchLayer();
  }

  /** Remove all the candidate points. */
  private removeCandidatePoints() {
    this.candidatePoints = [];
    this.updateSketchLayer();
  }

  /**
   * Callback function when snapping OSM way features are loaded.
   */
  private waysFeaturesLoadEnded() {
    if (!this.activeFeature) return;
    this.calculateCandidates(false);
  }

  private static getDefaultSketchStyle(): StyleLike {
    return feature => {
      if (feature.getProperties().candidate) {
        return feature.getGeometry()!.getType() === 'Point' ?
        new Style({
          image: new Circle({
            fill: new Fill({ color: '#00ffff' }),
            stroke: new Stroke({ color: '#ff0000', width: 1 }),
            radius: 2
          })
        })
        : new Style({
          stroke: new Stroke({
            width: 2,
            color: 'rgba(245,128,2,0.5)'
          })
        });
      } else if (feature.getGeometry()!.getType() === 'Point') {
        return createEditingStyle()['Point'];
      }
      return new Style({
        stroke: new Stroke({
          width: 4,
          color: '#02c0f5'
        })
      });
    };
  }
};
