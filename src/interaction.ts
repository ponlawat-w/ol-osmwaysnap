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
  wrapX?: boolean,

  /** Whether to allow creating a new feature (default: true) */
  allowCreate?: boolean,

  /** Whether allow geometry edition to start when clicking on an existing feature, the option can be later configured in allowEdit property of OSMWaySnap class (default: true) */
  allowEdit?: boolean
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
  /** Whether to allow geometry edition to start when clicking on an existing feature */
  public allowEdit: boolean = true;
  /** Whether to allow creating a new feature */
  public allowCreate: boolean = true
  /** True to automatically fit map view to next candidantes. */
  public autoFocus: boolean = true;
  /** Used with autoFocus, specify number to add padding to view fitting. */
  public focusPadding: number = 50;

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
  /** Partial line of the original geometry from active feature that will be either removed or merged by editing */
  private draftOriginalLine?: Feature<LineString> = undefined;
  /** Candidate points for selection on map */
  private candidatePoints: Feature<Point>[] = [];
  /** Candidate lines for selection on map */
  private candidateLines: Feature<LineString>[] = [];
  /** Indicate if sketchLine is merging to draft original line */
  private mergingDraftOriginalLine: boolean = false;

  /** Target source of edition */
  private source: VectorSource<Feature<LineString>>;
  /** Ways source for snapping */
  private waySource: VectorSource<Feature<LineString>>;

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
    if (options.allowCreate !== undefined) this.allowCreate = options.allowCreate;
    if (options.allowEdit !== undefined) this.allowEdit = options.allowEdit;
    if (options.autoFocus !== undefined) this.autoFocus = options.autoFocus;
    if (options.focusPadding !== undefined) this.focusPadding = options.focusPadding;
    this.source = options.source;
    this.waySource = options.waySource ?? new OSMOverpassWaySource({
      cachedFeaturesCount: options.cachedFeaturesCount ?? undefined,
      fetchBufferSize: options.fetchBufferSize ?? undefined,
      maximumResolution: options.maximumResolution ?? undefined,
      overpassQuery: options.overpassQuery ?? '(way["highway"];>;);',
      overpassEndpointURL: options.overpassEndpointURL ?? undefined
    });
    this.snapInteraction = new Snap({ source: this.waySource });

    if (options.createAndAddWayLayer ?? true) {
      this.wayLayer = new VectorLayer({ source: this.waySource, style: OSMOverpassWaySource.getDefaultStyle() });
    }
    this.overlayLayer = new VectorLayer({
      source: new VectorSource({ useSpatialIndex: false, wrapX: options.wrapX ?? true }),
      updateWhileInteracting: true,
      style: options.sketchStyle ?? OSMWaySnap.getDefaultOverlayStyle()
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
    if (this.autoFocus && this.map && this.activeFeature && this.coordinates.length > 1) {
      this.map.getView().fit(this.activeFeature.getGeometry()!.getExtent(), { padding: Array(4).fill(this.focusPadding) });
    }
    this.activeFeature = undefined;
    this.coordinates = [];
    this.removeSketchPoint();
    this.removeSketchLine();
    this.removeCandidateLines();
    this.removeCandidatePoints();
    if (this.draftOriginalLine && this.waySource.hasFeature(this.draftOriginalLine)) {
      this.waySource.removeFeature(this.draftOriginalLine);
    }
    this.draftOriginalLine = undefined;
    this.mergingDraftOriginalLine = false;
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
      if (this.allowEdit) {
        const overlappedFeatures = this.source.getFeatures().filter(f => f.getGeometry()?.intersectsCoordinate(event.coordinate) ?? false);
        if (overlappedFeatures.length) {
          this.enterEditMode(overlappedFeatures[0], event.coordinate);
          this.updateFeature();
          return false;
        }
      }
      if (this.allowCreate) {
        this.coordinates = [this.sketchPoint?.getGeometry()!.getCoordinates() ?? event.coordinate];
        this.updateFeature();
        return false;
      }
      return super.handleEvent(event);
    }
    const lastCoors = this.activeFeature!.getGeometry()!.getLastCoordinate();
    if (lastCoors[0] === event.coordinate[0] && lastCoors[1] === event.coordinate[1]) {
      this.finishEditing();
      return false;
    }
    if (this.sketchLine) {
      this.coordinates.push(...this.sketchLine.getGeometry()!.getCoordinates().slice(1));
      this.updateFeature();
      if (this.mergingDraftOriginalLine) this.finishEditing();
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
   * Start editing on the selected feature
   * @param feature Feature to edit
   * @param fromCoordinate Coordinate on feature geometry to starts altering, the original vertices after this coordinate will go to draft in overlay layer
   */
  private enterEditMode(feature: Feature<LineString>, fromCoordinate: Coordinate) {
    const originalCoordinates = feature.getGeometry()!.getCoordinates();
    const fromCoordinateIdx = originalCoordinates.findIndex(c => c[0] === fromCoordinate[0] && c[1] === fromCoordinate[1]);
    this.coordinates = originalCoordinates.slice(0, fromCoordinateIdx + 1);
    this.draftOriginalLine = new Feature({
      draft: true,
      geometry: new LineString(
        originalCoordinates.slice(fromCoordinateIdx)
      )
    });
    this.waySource.addFeature(this.draftOriginalLine);
    feature.getGeometry()!.setCoordinates(this.coordinates);
    this.activeFeature = feature;
    this.mergingDraftOriginalLine = false;
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
   * Update the over layer.
   */
  private updateOverlayLayer() {
    const source = this.overlayLayer.getSource()!;
    source.clear(true);
    if (this.draftOriginalLine) source.addFeature(this.draftOriginalLine);
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
    if (!this.allowCreate && !this.activeFeature) {
      return this.removeSketchPoint();
    }
    if (this.sketchPoint) {
      this.sketchPoint.getGeometry()!.setCoordinates(coordinate);
    } else {
      this.sketchPoint = new Feature(new Point(coordinate));
    }
    this.updateOverlayLayer();    
  }

  /**
   * This method alter array in place.
   * If the last coordinate is on draftOriginalLine, extend it from the last coordinate until the remaining of the draftOriginalLine
   * @param coordinates Original sketch line coordinates to get extended
   */
  private extendSketchLineCoorsToDraftOriginal(coordinates: Coordinate[]) {
    const lastCoordinate = coordinates[coordinates.length - 1];
    if (!this.draftOriginalLine || !this.draftOriginalLine.getGeometry()!.intersectsCoordinate(lastCoordinate)) return;
    let lineToExtend = this.draftOriginalLine.getGeometry()!;
    let idx = this.draftOriginalLine.getGeometry()!.getCoordinates()
      .findIndex(c => c[0] === lastCoordinate[0] && c[1] === lastCoordinate[1]);
    if (idx < 0) {
      lineToExtend = LineStringUtils.split(lineToExtend, lastCoordinate);
    }
    const extendFromIdx = lineToExtend.getCoordinates().findIndex(c => c[0] === lastCoordinate[0] && c[1] === lastCoordinate[1]);
    coordinates.push(...lineToExtend.getCoordinates().slice(extendFromIdx + 1));
    this.mergingDraftOriginalLine = true;
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

    if (this.allowEdit) {
      this.extendSketchLineCoorsToDraftOriginal(sketchCoors);
    }

    if (this.sketchLine) {
      this.sketchLine.getGeometry()!.setCoordinates(sketchCoors);
    } else {
      this.sketchLine = new Feature(new LineString(sketchCoors));
    }
    this.updateOverlayLayer();
  }

  /** Remove sketch point. */
  private removeSketchPoint() {
    this.sketchPoint = undefined;
    this.updateOverlayLayer();
  }

  /** Remove sketch line. */
  private removeSketchLine() {
    this.sketchLine = undefined;
    this.updateOverlayLayer();
  }

  /** Remove all the candidate lines. */
  private removeCandidateLines() {
    this.candidateLines = [];
    this.updateOverlayLayer();
  }

  /** Remove all the candidate points. */
  private removeCandidatePoints() {
    this.candidatePoints = [];
    this.updateOverlayLayer();
  }

  /**
   * Callback function when snapping OSM way features are loaded.
   */
  private waysFeaturesLoadEnded() {
    if (!this.activeFeature) return;
    this.calculateCandidates(false);
  }

  /**
   * 
   * @returns 
   */
  private static getDefaultOverlayStyle(): StyleLike {
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
      } else if (feature.getProperties().draft) {
        return new Style({
          stroke: new Stroke({
            width: 4,
            color: 'rgba(60,60,60,0.7)'
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
