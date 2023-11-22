import Map from 'ol/Map';
import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import MultiPoint from 'ol/geom/MultiPoint';
import VectorSource from 'ol/source/Vector';
import PointerInteraction from 'ol/interaction/Pointer';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style, { createEditingStyle } from 'ol/style/Style';
import LineStringUtils from './utils/line-string';
import type { Coordinate } from 'ol/coordinate';
import type { StyleLike } from 'ol/style/Style';
import type { MapBrowserEvent } from 'ol';

/** Options for OSMWaySnap interaction */
export type OSMWaySnapOptions = {
  /** True to automatically fit map view to next candidantes. */
  autoFocus?: boolean,

  /** Used with autoFocus, specify number to add padding to view fitting. */
  focusPadding?: number,

  /** Style of sketch features */
  sketchStyle?: StyleLike,

  /** Target source of edition */
  source: VectorSource<Feature<LineString>>,

  /** Source to OSMWays for snapping */
  waySource: VectorSource<Feature<LineString>>,

  /** WrapX */
  wrapX?: boolean
};

const DEFAULT_SKETCH_STYLE: StyleLike = feature => {
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

/**
 * Interaction for snapping linestring to way elements from OSM
 * This is designed to use with Snap interaction.
 */
export default class OSMWaySnap extends PointerInteraction {
  /** Options */
  private options: OSMWaySnapOptions;

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

  /**
   * Constructor
   * @param options Options
   */
  public constructor(options: OSMWaySnapOptions) {
    super();
    this.options = {
      ...options,
      autoFocus: options.autoFocus === undefined ? true : options.autoFocus,
      focusPadding: options.focusPadding ?? 50,
    };
    this.overlayLayer = new VectorLayer({
      source: new VectorSource({ useSpatialIndex: false, wrapX: this.options.wrapX }),
      updateWhileInteracting: true,
      style: this.options.sketchStyle ?? DEFAULT_SKETCH_STYLE
    });
    this.addChangeListener('active', this.updateState);
  }

  /**
   * Remove the interaction from its current map and attach it to the new map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param map Map.
   */
  public setMap(map: Map|null) {
    super.setMap(map);
    this.updateState();
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
      if (this.coordinates.length > 1 && !this.options.source.hasFeature(this.activeFeature)) {
        this.options.source.addFeature(this.activeFeature);
      }
    }
    this.calculateCandidates();
  }

  /**
   * Given a candidate linestring, return coordinate set from the tip of the active feature following that line until the cursor coordinate,
   *  or return an empty coordinate set if the candidate is not valid according to cursor position.
   * @param mouseCoor Coordinate of user cursor
   * @param lineString A candidate way linestring
   * @returns Coordinates set of sketch line
   */
  private getSketchLineCoordinates(mouseCoor: Coordinate, lineString: LineString): Coordinate[] {
    const lastFeatureCoors = this.activeFeature!.getGeometry()!.getLastCoordinate();
    if (!lineString.getCoordinates().some(c => c[0] === lastFeatureCoors[0] && c[1] === lastFeatureCoors[1])) {
      lineString = LineStringUtils.split(lineString, lastFeatureCoors);
    }
    if (!lineString.getCoordinates().some(c => c[0] === mouseCoor[0] && c[1] === mouseCoor[1])) {
      lineString = LineStringUtils.split(lineString, mouseCoor);
    }

    const lastFeatureCoorsIdx = lineString.getCoordinates()
      .findIndex(c => c[0] === lastFeatureCoors[0] && c[1] === lastFeatureCoors[1]);
    if (lastFeatureCoorsIdx < 0) return [];

    const mouseCoorsIdx = (
      lineString.getFirstCoordinate()[0] === lineString.getLastCoordinate()[0]
      && lineString.getLastCoordinate()[1] === lineString.getLastCoordinate()[1]
      && lineString.getFirstCoordinate()[0] === mouseCoor[0]
      && lineString.getFirstCoordinate()[1] === mouseCoor[1]
    ) ? (lastFeatureCoorsIdx + 1 > lineString.getCoordinates().length / 2 ? lineString.getCoordinates().length - 1 : 0)
        : lineString.getCoordinates().findIndex(c => c[0] === mouseCoor[0] && c[1] === mouseCoor[1]);;
    if (mouseCoorsIdx < 0) return [];
    if (mouseCoorsIdx === lastFeatureCoorsIdx) return [];

    if (lastFeatureCoorsIdx < mouseCoorsIdx) {
      return lineString.getCoordinates()
        .slice(lastFeatureCoorsIdx, mouseCoorsIdx + 1)
        .map(c => [...c]);
    }
    return lineString.getCoordinates()
      .slice(mouseCoorsIdx, lastFeatureCoorsIdx + 1)
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
        map.getView().fit(new MultiPoint(fitCoordinates), {
          padding: Array(4).fill(this.options.focusPadding)
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
    this.candidateLines = this.options.waySource.getFeatures().filter(
      feature => feature.getGeometry()!.containsXY(lastFeatureCoors[0], lastFeatureCoors[1])
    ).map(f => {
      f = new Feature(f.getGeometry());
      f.setProperties({ candidate: true });
      return f;
    });
    this.candidatePoints = this.candidateLines.map(l => l.getGeometry()!.getCoordinates()).flat()
      .map(c => new Feature<Point>({ candidate: true, geometry: new Point(c) }));
    if (fit && this.options.autoFocus) {
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
    const candidates = new VectorSource({
      features: this.candidateLines.filter(
        feature => feature.getGeometry()!.containsXY(coordinate[0], coordinate[1])
      )
    });
    const closestCandidate = candidates.getClosestFeatureToCoordinate(coordinate);
    const lineCoors = closestCandidate ?
      this.getSketchLineCoordinates(coordinate, closestCandidate.getGeometry()!)
      : [this.activeFeature!.getGeometry()!.getLastCoordinate(), coordinate];
    if (!lineCoors.length) {
      return this.removeSketchLine();
    }

    if (this.sketchLine) {
      this.sketchLine.getGeometry()!.setCoordinates(lineCoors);
    } else {
      this.sketchLine = new Feature(new LineString(lineCoors));
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

  /** Called when the editing is finished, clear all the sketching and candidates. */
  private finishEditing() {
    this.activeFeature = undefined;
    this.coordinates = [];
    this.removeSketchPoint();
    this.removeSketchLine();
    this.removeCandidateLines();
    this.removeCandidatePoints();
  }

  /**
   * Callback function when snapping OSM way features are loaded.
   */
  private waysFeaturesLoadEnded() {
    if (!this.activeFeature) return;
    this.calculateCandidates(false);
  }

  /**
   * When the interaction state is changed (assigned or unassigned to maps).
   */
  private updateState() {
    const map = this.getMap();
    const active = this.getActive();
    this.overlayLayer.setMap(active ? map : null);
    if (map) {
      this.options.waySource.on('featuresloadend', this.waysFeaturesLoadEnded.bind(this));
    } else {
      this.options.waySource.un('featuresloadend', this.waysFeaturesLoadEnded.bind(this));
    }
  }
};
