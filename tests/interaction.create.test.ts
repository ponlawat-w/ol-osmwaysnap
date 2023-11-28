import { beforeEach, describe, expect, it } from 'vitest';
import { Map, View } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Projection } from 'ol/proj';
import { getDefaultWaySource, mouseClick, mouseMove } from './common';
import { OSMWaySnap, OSMWaySnapEventType } from '../dist';
import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom';

describe('Test OSMWaySnap Interaction: Line Creation', () => {
  let map: Map;
  let interaction: OSMWaySnap;
  let targetLayer: VectorLayer<VectorSource<Feature<LineString>>>;
  const getSketchLine = (): Feature<LineString>|undefined => (interaction as any).sketchLine;

  beforeEach(() => {
    window.document.body.innerHTML = '<div id="map" style="width: 1600px; height: 900px;"></div>';

    const view = new View({
      center: [0, 0],
      zoom: 10,
      projection: new Projection({
        code: 'CUSTOM',
        extent: [-100, -100, 100, 100]
      })
    });

    targetLayer = new VectorLayer({ source: new VectorSource() });

    const waySource = getDefaultWaySource();
    const wayLayer = new VectorLayer({ source: waySource });

    map = new Map({
      target: 'map',
      view,
      layers: [
        targetLayer, wayLayer
      ]
    });
    interaction = new OSMWaySnap({
      source: targetLayer.getSource()!,
      waySource
    });
    map.addInteraction(interaction);
  });

  it('draws sketch point on mouse moving', () => {
    mouseMove(map, interaction, [-50, -75]);

    const sketchPoint = (interaction as any).sketchPoint as Feature<Point>;
    expect(sketchPoint).toBeTruthy();

    const coor = sketchPoint.getGeometry()!.getFirstCoordinate();
    expect(coor).toEqual([-50, -75]);
  });

  it('creates a feature when click on points', () => {
    expect(interaction.getActiveFeature()).toBeUndefined();

    mouseMove(map, interaction, [0, -50]);
    mouseClick(map, interaction, [0, -50]);
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);

    expect(interaction.getActiveFeature()).toBeTruthy();
    
    const coors = interaction.getActiveFeature()!.getGeometry()!.getCoordinates();
    expect(coors.length).toEqual(2);
    expect(coors[0]).toEqual([0, -50]);
    expect(coors[1]).toEqual([0, 0]);

    expect(
      targetLayer.getSource()!.getFeatures()
        .some(f => f === interaction.getActiveFeature())
    ).toBeTruthy();
  });

  it('does not create a new feature if disabled', () => {
    interaction.allowCreate = false;

    expect(interaction.getActiveFeature()).toBeUndefined();
    mouseMove(map, interaction, [0, -50]);
    mouseClick(map, interaction, [0, -50]);
    expect(interaction.getActiveFeature()).toBeUndefined();
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    expect(interaction.getActiveFeature()).toBeUndefined();
  });

  it('draws sketch line on mouse moving after started', () => {
    mouseMove(map, interaction, [0, -50]);
    let sketchLine = getSketchLine();
    expect(sketchLine).toBeUndefined();

    mouseClick(map, interaction, [0, -50]);
    mouseMove(map, interaction, [0, 0]);
    sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    expect(sketchLine!.getGeometry()!.getCoordinates().length).toEqual(2);
    expect(sketchLine!.getGeometry()!.getFirstCoordinate()).toEqual([0, -50]);
    expect(sketchLine!.getGeometry()!.getLastCoordinate()).toEqual([0, 0]);

    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [0, 10]);
    sketchLine = getSketchLine();
    expect(sketchLine!.getGeometry()!.getCoordinates().length).toEqual(2);
    expect(sketchLine!.getGeometry()!.getFirstCoordinate()).toEqual([0, 0]);
    expect(sketchLine!.getGeometry()!.getLastCoordinate()).toEqual([0, 10]);
  });

  it('traces sketch line and appends line following way source', () => {
    mouseMove(map, interaction, [0, -50]);
    mouseClick(map, interaction, [0, -50]);
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [-50, 25]);
    const sketchLine = getSketchLine();
    expect(sketchLine!.getGeometry()!.getCoordinates().length).toEqual(3);
    expect(sketchLine!.getGeometry()!.getCoordinates()[0]).toEqual([0, 0]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[1]).toEqual([-25, 25]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[2]).toEqual([-50, 25]);

    mouseClick(map, interaction, [-50, 25]);
    const activeGeometry = interaction.getActiveFeature()!.getGeometry()!;
    expect(activeGeometry.getCoordinates().length).toEqual(4);
    expect(activeGeometry.getCoordinates()[0]).toEqual([0, -50]);
    expect(activeGeometry.getCoordinates()[1]).toEqual([0, 0]);
    expect(activeGeometry.getCoordinates()[2]).toEqual([-25, 25]);
    expect(activeGeometry.getCoordinates()[3]).toEqual([-50, 25]);
  });

  it('displays candidate lines and points on a junction as active feature tip', () => {
    mouseMove(map, interaction, [0, -50]);
    mouseClick(map, interaction, [0, -50]);
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [-1, -1]);

    const candidateLines = (interaction as any).candidateLines as Feature<LineString>[];
    expect(candidateLines.length).toEqual(4);
    expect(
      [
        'fDownToCenter',
        'fCenterTurnLeft',
        'fCenterToBeforeLoop',
        'fCenterTurnRight'
      ].every(id => candidateLines.some(l => l.getId() === id))
    ).toBeTruthy();

    const candidateCoordinates = ((interaction as any).candidatePoints as Feature<Point>[])
      .map(p => p.getGeometry()!.getFirstCoordinate());
    expect(
      [
        [-25, 25],
        [-50, 25],
        [0, -50],
        [0, 0],
        [0, 10],
        [25, 25],
        [50, 25]
      ].every(
        c => candidateCoordinates.some(cc => c[0] === cc[0] && c[1] === cc[1])
      )
    );
  });

  it('reverts sketch line when creation order is opposite with the vertex sequence', () => {
    mouseMove(map, interaction, [-50, 25]);
    mouseClick(map, interaction, [-50, 25]);
    mouseMove(map, interaction, [0, 0]);

    const sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    expect(sketchLine!.getGeometry()!.getCoordinates().length).toEqual(3);
    expect(sketchLine!.getGeometry()!.getCoordinates()[0]).toEqual([-50, 25]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[1]).toEqual([-25, 25]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[2]).toEqual([0, 0]);

    mouseClick(map, interaction, [0, 0]);

    const activeFeature = interaction.getActiveFeature();
    expect(activeFeature).toBeTruthy();
    expect(activeFeature!.getGeometry()!.getCoordinates().length).toEqual(3);
    expect(activeFeature!.getGeometry()!.getCoordinates()[0]).toEqual([-50, 25]);
    expect(activeFeature!.getGeometry()!.getCoordinates()[1]).toEqual([-25, 25]);
    expect(activeFeature!.getGeometry()!.getCoordinates()[2]).toEqual([0, 0]);
  });

  it('partially creates from candidate line when user click from an intermediate vertex', () => {
    mouseMove(map, interaction, [-20, 10]);
    mouseClick(map, interaction, [-20, 10]);
    mouseMove(map, interaction, [-10, 10]);
    mouseClick(map, interaction, [-10, 10]);
    mouseMove(map, interaction, [0, 20]);

    const sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    expect(sketchLine!.getGeometry()!.getCoordinates().length).toEqual(3);
    expect(sketchLine!.getGeometry()!.getCoordinates()[0]).toEqual([-10, 10]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[1]).toEqual([-10, 20]);
    expect(sketchLine!.getGeometry()!.getCoordinates()[2]).toEqual([0, 20]);

    mouseClick(map, interaction, [10, 10]);
    const activeFeature = interaction.getActiveFeature();
    expect(activeFeature).toBeTruthy();
    expect(activeFeature!.getGeometry()!.getCoordinates().length).toEqual(4);
    expect(activeFeature!.getGeometry()!.getCoordinates()[0]).toEqual([-20, 10]);
    expect(activeFeature!.getGeometry()!.getCoordinates()[1]).toEqual([-10, 10]);
    expect(activeFeature!.getGeometry()!.getCoordinates()[2]).toEqual([-10, 20]);
    expect(activeFeature!.getGeometry()!.getCoordinates()[3]).toEqual([0, 20]);
  });

  it('correctly handles when user click on a candidate line but not on its vertex', () => {
    mouseMove(map, interaction, [0, -25]);
    mouseClick(map, interaction, [0, -25]);
    mouseMove(map, interaction, [0, 0]);

    let candidateLines = (interaction as any).candidateLines as Feature<LineString>[];
    expect(candidateLines.length).toEqual(1);
    expect(candidateLines[0].getId()).toEqual('fDownToCenter');

    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [-1, -1]);
    candidateLines = (interaction as any).candidateLines as Feature<LineString>[];
    expect(candidateLines.length).toEqual(4);

    const activeFeatureCoors = interaction.getActiveFeature()!.getGeometry()!.getCoordinates();
    expect(activeFeatureCoors.length).toEqual(2);
    expect(activeFeatureCoors[0]).toEqual([0, -25]);
    expect(activeFeatureCoors[1]).toEqual([0, 0]);
  });

  it('disables sketching when candidate is a loop', () => {
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [0, 10]);
    mouseClick(map, interaction, [0, 10]);
    mouseMove(map, interaction, [0, 0]);
    mouseMove(map, interaction, [0, 10]);
    let sketchLine = getSketchLine();
    expect(sketchLine).toBeUndefined();
    
    interaction.finishEditing();
    
    mouseMove(map, interaction, [10, 20]);
    mouseClick(map, interaction, [10, 20]);
    mouseMove(map, interaction, [0, 0]);
    mouseMove(map, interaction, [10, 20]);
    sketchLine = getSketchLine();
    expect(sketchLine).toBeUndefined();
  });

  it('sketches shortest partial of loop when user starts from an intermediate vertex', () => {
    mouseMove(map, interaction, [0, 30]);
    mouseClick(map, interaction, [0, 30]);
    mouseMove(map, interaction, [0, 20]);
    mouseClick(map, interaction, [0, 20]);

    mouseMove(map, interaction, [10, 10]);
    let sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    let sketchLineCoors = sketchLine!.getGeometry()!.getCoordinates();
    expect(sketchLineCoors.length).toEqual(3);
    expect(sketchLineCoors[0]).toEqual([0, 20]);
    expect(sketchLineCoors[1]).toEqual([10, 20]);
    expect(sketchLineCoors[2]).toEqual([10, 10]);

    mouseMove(map, interaction, [-10, 10]);
    sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    sketchLineCoors = sketchLine!.getGeometry()!.getCoordinates();
    expect(sketchLineCoors.length).toEqual(3);
    expect(sketchLineCoors[0]).toEqual([0, 20]);
    expect(sketchLineCoors[1]).toEqual([-10, 20]);
    expect(sketchLineCoors[2]).toEqual([-10, 10]);

    interaction.finishEditing();

    mouseMove(map, interaction, [10, 10]);
    mouseClick(map, interaction, [10, 10]);
    mouseMove(map, interaction, [-10, 10]);
    sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    sketchLineCoors = sketchLine!.getGeometry()!.getCoordinates();
    expect(sketchLineCoors.length).toEqual(3);
    expect(sketchLineCoors[0]).toEqual([10, 10]);
    expect(sketchLineCoors[1]).toEqual([0, 10]);
    expect(sketchLineCoors[2]).toEqual([-10, 10]);

    interaction.finishEditing();
    mouseMove(map, interaction, [-10, 10]);
    mouseClick(map, interaction, [-10, 10]);
    mouseMove(map, interaction, [10, 10]);
    sketchLine = getSketchLine();
    expect(sketchLine).toBeTruthy();
    sketchLineCoors = sketchLine!.getGeometry()!.getCoordinates();
    expect(sketchLineCoors.length).toEqual(3);
    expect(sketchLineCoors[0]).toEqual([-10, 10]);
    expect(sketchLineCoors[1]).toEqual([0, 10]);
    expect(sketchLineCoors[2]).toEqual([10, 10]);
  });

  it('finished drawing when the last vertex is clicked twice', () => {
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);

    expect(interaction.getActiveFeature()).toBeUndefined();
    expect(targetLayer.getSource()!.getFeatures().length).toEqual(1);

    const coors = targetLayer.getSource()!.getFeatures()[0].getGeometry()!.getCoordinates();
    expect(coors.length).toEqual(3);
    expect(coors[0]).toEqual([0, 0]);
    expect(coors[1]).toEqual([25, 25]);
    expect(coors[2]).toEqual([50, 25]);
  });

  it('fires events when start creating and finish creating features', () => {
    let waySnapStart = false;
    let waySnapStartCreate = false;
    let waySnapStartEdit = false;
    let waySnapUpdate = false;
    let waySnapEnd = false;
    let startFeature: Feature<LineString>|undefined = undefined;
    let startCreateFeature: Feature<LineString>|undefined = undefined;
    let startEditFeature: Feature<LineString>|undefined = undefined;
    let updateFeature: Feature<LineString>|undefined = undefined;
    let endFeature: Feature<LineString>|undefined = undefined;
    interaction.on(OSMWaySnapEventType.WAYSNAPSTART, e => { waySnapStart = true; startFeature = e.feature; });
    interaction.on(OSMWaySnapEventType.WAYSNAPSTARTCREATE, e => { waySnapStartCreate = true; startCreateFeature = e.feature; });
    interaction.on(OSMWaySnapEventType.WAYSNAPSTARTEDIT, e => { waySnapStartEdit = true; startEditFeature = e.feature; });
    interaction.on(OSMWaySnapEventType.WAYSNAPUPDATE, e => { waySnapUpdate = true; updateFeature = e.feature; });
    interaction.on(OSMWaySnapEventType.WAYSNAPEND, e => { waySnapEnd = true; endFeature = e.feature; });

    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);

    expect(waySnapStart).toBeTruthy();
    expect(waySnapStartCreate).toBeTruthy();
    expect(waySnapStartEdit).toBeFalsy();
    expect(waySnapUpdate).toBeFalsy();
    expect(waySnapEnd).toBeFalsy();
    expect(startFeature).toBeDefined();
    expect(startCreateFeature).toBeDefined();
    expect(startEditFeature).toBeUndefined();
    expect(updateFeature).toBeUndefined();
    expect(endFeature).toBeUndefined();
    expect(startCreateFeature).toBe(startFeature);
    
    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);

    expect(waySnapUpdate).toBeTruthy();
    expect(waySnapEnd).toBeFalsy();
    expect(updateFeature).toBe(startCreateFeature);

    mouseClick(map, interaction, [50, 25]);

    expect(waySnapEnd).toBeTruthy();
    expect(endFeature).toBe(startCreateFeature);
  });
});
