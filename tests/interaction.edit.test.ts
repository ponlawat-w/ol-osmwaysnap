import { beforeEach, describe, expect, it } from 'vitest';
import { Map, View } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Projection } from 'ol/proj';
import { getDefaultWaySource, mouseClick, mouseMove } from './common';
import { OSMWaySnap, OSMWaySnapEventType } from '../src';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import type { Point } from 'ol/geom';

describe('Test OSMWaySnap Interaction: Line Edition', () => {
  let map: Map;
  let interaction: OSMWaySnap;
  let targetLayer: VectorLayer<VectorSource<Feature<LineString>>>;

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

    const defaultFeature = new Feature<LineString>(new LineString([
      [0, -50],
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 20],
      [0, 20],
      [0, 30]
    ]));

    targetLayer = new VectorLayer({ source: new VectorSource({ features: [defaultFeature] }) });

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

  it('shows sketch point when hovering on an editable line', () => {
    interaction.allowCreate = false;
    interaction.allowEdit = true;

    const getSketchPoint = () => (interaction as any).sketchPoint as Feature<Point>|undefined;

    mouseMove(map, interaction, [15, 15]);
    expect(getSketchPoint()).toBeUndefined();

    mouseMove(map, interaction, [10, 10]);
    expect(getSketchPoint()).toBeDefined();
    expect(getSketchPoint()!.getGeometry()!.getFirstCoordinate()).toEqual([10, 10]);
  });

  it('enables edit mode by spliting selected feature and displays the remaining as draft line after user clicks on an existing feature', () => {
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);

    const activeCoors = interaction.getActiveFeature()!.getGeometry()!.getCoordinates();
    expect(activeCoors.length).toEqual(2);
    expect(activeCoors[0]).toEqual([0, -50]);
    expect(activeCoors[1]).toEqual([0, 0]);

    const draftLine = (interaction as any).draftOriginalLine as Feature<LineString>;
    expect(draftLine).toBeDefined();
    expect(draftLine.getGeometry()!.getCoordinates().length).toEqual(6);
    expect(draftLine.getGeometry()!.getCoordinates()[0]).toEqual([0, 0]);
    expect(draftLine.getGeometry()!.getCoordinates()[1]).toEqual([0, 10]);
    expect(draftLine.getGeometry()!.getCoordinates()[2]).toEqual([10, 10]);
    expect(draftLine.getGeometry()!.getCoordinates()[3]).toEqual([10, 20]);
    expect(draftLine.getGeometry()!.getCoordinates()[4]).toEqual([0, 20]);
    expect(draftLine.getGeometry()!.getCoordinates()[5]).toEqual([0, 30]);
  });

  it('enables edit mode by spliting the selected feature on a line segment between vertices', () => {
    mouseMove(map, interaction, [0, 5]);
    mouseClick(map, interaction, [0, 5]);

    const activeCoors = interaction.getActiveFeature()!.getGeometry()!.getCoordinates();
    expect(activeCoors.length).toEqual(3);
    expect(activeCoors[0]).toEqual([0, -50]);
    expect(activeCoors[1]).toEqual([0, 0]);
    expect(activeCoors[2]).toEqual([0, 5]);

    const draftLine = (interaction as any).draftOriginalLine as Feature<LineString>;
    expect(draftLine).toBeDefined();
    expect(draftLine.getGeometry()!.getCoordinates().length).toEqual(6);
    expect(draftLine.getGeometry()!.getCoordinates()[0]).toEqual([0, 5]);
    expect(draftLine.getGeometry()!.getCoordinates()[1]).toEqual([0, 10]);
    expect(draftLine.getGeometry()!.getCoordinates()[2]).toEqual([10, 10]);
    expect(draftLine.getGeometry()!.getCoordinates()[3]).toEqual([10, 20]);
    expect(draftLine.getGeometry()!.getCoordinates()[4]).toEqual([0, 20]);
    expect(draftLine.getGeometry()!.getCoordinates()[5]).toEqual([0, 30]);
  });

  it('does not enable edit mode when not allowed', () => {
    interaction.allowEdit = false;

    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    expect((interaction as any).draftOriginalLine).toBeUndefined();
  });

  it('does not enable edit mode during creation mode even clicking on an existing feature', () => {
    mouseMove(map, interaction, [-50, 25]);
    mouseClick(map, interaction, [-50, 25]);
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    expect((interaction as any).draftOriginalLine).toBeUndefined();
  });

  it('allows user to redirect the shape from a certain point', () => {
    mouseMove(map, interaction, [0, 0]);
    mouseClick(map, interaction, [0, 0]);
    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);
    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);

    expect(interaction.getActiveFeature()).toBeUndefined();
    expect(targetLayer.getSource()!.getFeatures().length).toEqual(1);
    const coors = targetLayer.getSource()!.getFeatures()[0].getGeometry()!.getCoordinates();
    expect(coors.length).toEqual(4);
    expect(coors[0]).toEqual([0, -50]);
    expect(coors[1]).toEqual([0, 0]);
    expect(coors[2]).toEqual([25, 25]);
    expect(coors[3]).toEqual([50, 25]);
  });

  it('allows user to partially reshape an existing feature', () => {
    mouseMove(map, interaction, [0, 10]);
    mouseClick(map, interaction, [0, 10]);
    mouseMove(map, interaction, [-10, 20]);
    mouseClick(map, interaction, [-10, 20]);
    mouseMove(map, interaction, [0, 20]);
    mouseClick(map, interaction, [0, 20]);
    mouseMove(map, interaction, [0, 30]);
    mouseClick(map, interaction, [0, 30]);
    mouseMove(map, interaction, [0, 30]);
    mouseClick(map, interaction, [0, 30]);

    expect(interaction.getActiveFeature()).toBeUndefined();
    expect(targetLayer.getSource()!.getFeatures().length).toEqual(1);
    const coors = targetLayer.getSource()!.getFeatures()[0].getGeometry()!.getCoordinates();
    expect(coors.length).toEqual(7);
    expect(coors[0]).toEqual([0, -50]);
    expect(coors[1]).toEqual([0, 0]);
    expect(coors[2]).toEqual([0, 10]);
    expect(coors[3]).toEqual([-10, 10]);
    expect(coors[4]).toEqual([-10, 20]);
    expect(coors[5]).toEqual([0, 20]);
    expect(coors[6]).toEqual([0, 30]);
  });

  it('fires events when start editing and finish editing features', () => {
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
    expect(waySnapStartCreate).toBeFalsy();
    expect(waySnapStartEdit).toBeTruthy();
    expect(waySnapUpdate).toBeFalsy();
    expect(waySnapEnd).toBeFalsy();
    expect(startFeature).toBeDefined();
    expect(startCreateFeature).toBeUndefined();
    expect(startEditFeature).toBeDefined();
    expect(updateFeature).toBeUndefined();
    expect(endFeature).toBeUndefined();
    expect(startEditFeature).toBe(startFeature);
    
    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);

    expect(waySnapUpdate).toBeTruthy();
    expect(waySnapEnd).toBeFalsy();
    expect(updateFeature).toBe(startEditFeature);

    mouseMove(map, interaction, [50, 25]);
    mouseClick(map, interaction, [50, 25]);

    expect(waySnapEnd).toBeTruthy();
    expect(endFeature).toBe(startEditFeature);
  });
});
