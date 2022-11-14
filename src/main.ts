import MapboxDraw, {
  DrawCustomMode,
  DrawCustomModeThis,
  MapMouseEvent,
  MapTouchEvent,
} from "@mapbox/mapbox-gl-draw";
import * as Constants from "@mapbox/mapbox-gl-draw/src/constants";
import * as CommonSelectors from "@mapbox/mapbox-gl-draw/src/lib/common_selectors";
import createSupplementaryPoints from "@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points";
import doubleClickZoom from "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
import moveFeatures from "@mapbox/mapbox-gl-draw/src/lib/move_features";
import {
  bearing,
  center,
  destination,
  distance,
  point,
  midpoint,
  transformRotate,
  transformScale,
  AllGeoJSON,
} from "@turf/turf";
import { GeoJSON, Feature, Position, Point, Polygon } from "geojson";
import { LngLat } from "mapbox-gl";

import rotate from "./img/rotate.png";
import scale from "./img/scale.png";

type ScaleRotateModeState = {
  rotation?:
    | {
        feature0: GeoJSON; // initial feature state
        centers: Position[];
        headings: number[];
      }
    | null
    | undefined;
  scaling?:
    | {
        feature0: GeoJSON; // initial feature state
        centers: Position[];
        distances: number[];
      }
    | null
    | undefined;
  featureId: NonNullable<string | number | undefined>;
  feature: MapboxDraw.DrawPolygon;
  canTrash: boolean;
  canScale: boolean;
  canRotate: boolean;
  singleRotationPoint: boolean;
  rotationPointRadius: number;
  rotatePivot: number;
  scaleCenter: number;
  canSelectFeatures: boolean;
  dragMoveLocation: LngLat | null;
  dragMoving: boolean;
  canDragMove: boolean;
  selectedCoordPaths: string[];
  txMode?: number;
};

type ScaleRotateModeOptions = {
  canTrash?: boolean | undefined;
  canScale?: boolean | undefined;
  canRotate?: boolean | undefined;
  singleRotationPoint?: boolean | undefined;
  rotationPointRadius?: number | undefined;
  rotatePivot?: number | "center" | "opposite" | undefined;
  scaleCenter?: number | "center" | "opposite" | undefined;
  canSelectFeatures?: boolean | undefined;
  startPos?: LngLat;
  coordPath: string;
};

const isRotatePoint = CommonSelectors.isOfMetaType(Constants.meta.MIDPOINT);
const isVertex = CommonSelectors.isOfMetaType(Constants.meta.VERTEX);

type AdditionalProperties = {
  pathsToCoordinates: (
    featureId: string,
    paths: string[]
  ) => { coord_path: string; feature_id: string }[];
  computeBisectrix: (points: Feature[]) => void;
  _createRotationPoint: (
    rotationWidgets: Feature[],
    featureId: string,
    v1: MapboxDraw.DrawPoint,
    v2: MapboxDraw.DrawPoint,
    rotCenter: Feature<Point>,
    radiusScale: number
  ) => void;
  createRotationPoints: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    geojson: Feature,
    suppPoints: MapboxDraw.DrawPoint[]
  ) => Feature[] | undefined;
  startDragging: (
    this: DrawCustomModeThis,
    state: ScaleRotateModeState,
    e: MapMouseEvent | MapTouchEvent
  ) => void;
  stopDragging: (this: DrawCustomModeThis, state: ScaleRotateModeState) => void;
  onVertex: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent | MapTouchEvent
  ) => void;
  computeRotationCenter: (
    this: DrawCustomModeThis,
    state: ScaleRotateModeState,
    geojson: GeoJSON
  ) => Feature<Point>;
  onRotatePoint: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent | MapTouchEvent
  ) => void;
  onFeature: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent | MapTouchEvent
  ) => void;
  computeAxes: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    polygon: GeoJSON
  ) => void;
  coordinateIndex: (coordinateIndex: string[]) => number;
  dragRotatePoint: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent,
    delta: {
      lng: number;
      lat: number;
    }
  ) => void;
  dragScalePoint: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent,
    delta: {
      lng: number;
      lat: number;
    }
  ) => void;
  dragFeature: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent,
    delta: {
      lng: number;
      lat: number;
    }
  ) => void;
  fireUpdate: (this: DrawCustomModeThis & AdditionalProperties) => void;
  clickActiveFeature: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState
  ) => void;
  clickNoTarget: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent
  ) => void;
  clickInactive: (
    this: DrawCustomModeThis & AdditionalProperties,
    state: ScaleRotateModeState,
    e: MapMouseEvent
  ) => void;
};

export const scaleRotateMode: DrawCustomMode<
  ScaleRotateModeState,
  ScaleRotateModeOptions
> &
  AdditionalProperties = {
  onSetup: function (opts) {
    const selectedFeature = this.getSelected()[0];

    if (!selectedFeature) {
      throw new Error("No feature is selected.");
    }

    if (selectedFeature.type !== Constants.geojsonTypes.POLYGON) {
      throw new TypeError("ScaleRotateMode can only handle 'POLYGON' feature.");
    }

    const state: ScaleRotateModeState = {
      featureId: selectedFeature.id,
      feature: selectedFeature,
      canTrash: opts.canTrash ?? true,
      canScale: opts.canScale ?? true,
      canRotate: opts.canRotate ?? true,
      singleRotationPoint: opts.singleRotationPoint ?? false,
      rotationPointRadius: opts.rotationPointRadius ?? 1.0,

      rotatePivot: parseScaleRotateCenter(
        opts.rotatePivot,
        ScaleRotateCenter.Center
      ),
      scaleCenter: parseScaleRotateCenter(
        opts.scaleCenter,
        ScaleRotateCenter.Center
      ),
      canSelectFeatures: opts.canSelectFeatures ?? true,
      dragMoveLocation: opts.startPos || null,
      dragMoving: false,
      canDragMove: false,
      selectedCoordPaths: opts.coordPath ? [opts.coordPath] : [],
    };

    if (!state.canRotate && !state.canScale) {
      console.warn("None of canScale or canRotate is true");
    }

    this.setSelectedCoordinates(
      this.pathsToCoordinates(
        String(selectedFeature.id),
        state.selectedCoordPaths
      )
    );
    this.setSelected(String(selectedFeature.id));
    doubleClickZoom.disable(this);

    this.setActionableState({
      combineFeatures: false,
      uncombineFeatures: false,
      trash: state.canTrash,
    });

    this.map.loadImage(rotate, (error, image) => {
      if (error) throw error;
      if (!image) throw "Failed to load rotate icon image.";
      this.map.addImage("rotate", image);
    });
    this.map.loadImage(scale, (error, image) => {
      if (error) throw error;
      if (!image) throw "Failed to load scale icon image.";
      this.map.addImage("scale", image);
    });

    return state;
  },

  toDisplayFeatures: function (state, geojson, push) {
    if (
      geojson.type === "Feature" &&
      state.featureId === geojson.properties?.id
    ) {
      geojson.properties.active = Constants.activeStates.ACTIVE;
      push(geojson);

      const suppPoints = createSupplementaryPoints(geojson, {
        map: this.map,
        midpoints: false,
        selectedPaths: state.selectedCoordPaths,
      });

      if (state.canScale) {
        this.computeBisectrix(suppPoints);
        suppPoints.forEach(push);
      }

      if (state.canRotate) {
        const rotPoints = this.createRotationPoints(state, geojson, suppPoints);
        rotPoints?.forEach(push);
      }
    }
    // else {
    //     geojson.properties.active = Constants.activeStates.INACTIVE;
    //     push(geojson);
    // }

    // this.fireActionable(state);
    this.setActionableState({
      combineFeatures: false,
      uncombineFeatures: false,
      trash: state.canTrash,
    });

    // this.fireUpdate();
  },

  onStop: function () {
    doubleClickZoom.enable(this);
    this.clearSelectedCoordinates();
  },

  pathsToCoordinates: function (featureId, paths) {
    return paths.map((coord_path) => {
      return { feature_id: featureId, coord_path };
    });
  },

  computeBisectrix: function (points) {
    for (let i1 = 0; i1 < points.length; i1++) {
      const i0 = (i1 - 1 + points.length) % points.length;
      const i2 = (i1 + 1) % points.length;

      const pointI0 = points[i0];
      const pointI1 = points[i1];
      const pointI2 = points[i2];

      if (
        !pointI0 ||
        !pointI1 ||
        !pointI2 ||
        pointI0.geometry.type !== "Point" ||
        pointI1.geometry.type !== "Point" ||
        pointI2.geometry.type !== "Point"
      )
        return;

      //   const l1 = lineString([
      //     pointI0.geometry.coordinates,
      //     pointI1.geometry.coordinates,
      //   ]);
      //   const l2 = lineString([
      //     pointI1.geometry.coordinates,
      //     pointI2.geometry.coordinates,
      //   ]);
      const a1 = bearing(
        pointI0.geometry.coordinates,
        pointI1.geometry.coordinates
      );
      const a2 = bearing(
        pointI2.geometry.coordinates,
        pointI1.geometry.coordinates
      );

      let a = (a1 + a2) / 2.0;

      if (a < 0.0) a += 360;
      if (a > 360) a -= 360;

      if (pointI1.properties) {
        pointI1.properties.heading = a;
      }
    }
  },

  _createRotationPoint: function (
    rotationWidgets,
    featureId,
    v1,
    v2,
    rotCenter,
    radiusScale
  ) {
    const cR0 = midpoint(v1, v2).geometry.coordinates;
    const heading = bearing(rotCenter, cR0);
    const distance0 = distance(rotCenter, cR0);
    const distance1 = radiusScale * distance0; // TODO depends on map scale
    const cR1 = destination(rotCenter, distance1, heading, {}).geometry
      .coordinates;

    rotationWidgets.push({
      type: Constants.geojsonTypes.FEATURE,
      properties: {
        meta: Constants.meta.MIDPOINT,
        icon: "rotate",
        parent: featureId,
        lng: cR1[0],
        lat: cR1[1],
        coord_path: v1.properties?.coord_path,
        heading: heading,
      },
      geometry: {
        type: Constants.geojsonTypes.POINT,
        coordinates: cR1,
      },
    });
  },

  createRotationPoints: function (state, geojson, suppPoints) {
    const { type } = geojson.geometry;
    const featureId = geojson.properties && geojson.properties.id;

    const rotationWidgets: Feature[] = [];
    if (
      type === Constants.geojsonTypes.POINT ||
      type === Constants.geojsonTypes.MULTI_POINT
    ) {
      return;
    }

    const corners = suppPoints.slice(0);
    const corner0 = corners[0];
    const corner1 = corners[1];
    if (!corner0 || !corner1) return;
    corners[corners.length] = corner0;

    let v1: MapboxDraw.DrawPoint | null = null;

    const rotCenter = this.computeRotationCenter(state, geojson);

    if (state.singleRotationPoint) {
      this._createRotationPoint(
        rotationWidgets,
        featureId,
        corner0,
        corner1,
        rotCenter,
        state.rotationPointRadius
      );
    } else {
      corners.forEach((v2) => {
        if (v1 != null) {
          this._createRotationPoint(
            rotationWidgets,
            featureId,
            v1,
            v2,
            rotCenter,
            state.rotationPointRadius
          );
        }

        v1 = v2;
      });
    }
    return rotationWidgets;
  },

  startDragging: function (state, e) {
    this.map.dragPan.disable();
    state.canDragMove = true;
    state.dragMoveLocation = e.lngLat;
  },

  stopDragging: function (state) {
    this.map.dragPan.enable();
    state.dragMoving = false;
    state.canDragMove = false;
    state.dragMoveLocation = null;
  },

  onTouchStart: function (state, e) {
    if (isVertex(e)) return this.onVertex(state, e);
    if (isRotatePoint(e)) return this.onRotatePoint(state, e);
    if (CommonSelectors.isActiveFeature(e)) return this.onFeature(state, e);
    // if (isMidpoint(e)) return this.onMidpoint(state, e);
  },

  onMouseDown: function (state, e) {
    if (isVertex(e)) return this.onVertex(state, e);
    if (isRotatePoint(e)) return this.onRotatePoint(state, e);
    if (CommonSelectors.isActiveFeature(e)) return this.onFeature(state, e);
    // if (isMidpoint(e)) return this.onMidpoint(state, e);
  },

  onVertex: function (state, e) {
    // convert internal MapboxDraw feature to valid GeoJSON:
    this.computeAxes(state, state.feature.toGeoJSON());

    this.startDragging(state, e);
    const about = e.featureTarget.properties;
    if (!about) return;
    state.selectedCoordPaths = [about.coord_path];
    state.txMode = txMode.Scale;
  },

  onRotatePoint: function (state, e) {
    // convert internal MapboxDraw feature to valid GeoJSON:
    this.computeAxes(state, state.feature.toGeoJSON());

    this.startDragging(state, e);
    const about = e.featureTarget.properties;
    if (!about) return;
    state.selectedCoordPaths = [about.coord_path];
    state.txMode = txMode.Rotate;
  },

  onFeature: function (state, e) {
    state.selectedCoordPaths = [];
    this.startDragging(state, e);
  },

  coordinateIndex: function (coordPaths) {
    const coordPath = coordPaths[0];
    if (coordPath) {
      const parts = coordPath.split(".");
      return parseInt(parts[parts.length - 1] ?? "");
    } else {
      return 0;
    }
  },

  computeRotationCenter: function (state, polygon) {
    const center0 = center(polygon as AllGeoJSON);
    return center0;
  },

  computeAxes: function (state, geojson) {
    // 追加ロジック
    if (geojson.type !== "Feature") return;
    const geometry = geojson.geometry;
    // TODO check min 3 points
    const center0 = this.computeRotationCenter(state, geojson);
    let corners: Position[] = [];

    // 変更ロジック
    switch (geometry.type) {
      case Constants.geojsonTypes.POLYGON:
        corners = geometry.coordinates[0]?.slice(0) ?? [];
        break;
      case Constants.geojsonTypes.MULTI_POLYGON:
        corners = geometry.coordinates
          .reduce((prev, curr) => [...prev, ...curr], [])
          .reduce((prev, curr) => [...prev, ...curr], []);
        break;
      case Constants.geojsonTypes.LINE_STRING:
        corners = geometry.coordinates;
        break;
      case Constants.geojsonTypes.MULTI_LINE_STRING:
        corners = geometry.coordinates.reduce(
          (prev, curr) => [...prev, ...curr],
          []
        );
        break;
      default:
        break;
    }

    // 変更前
    // if (geojson.geometry.type === Constants.geojsonTypes.POLYGON)
    //   corners = polygon.geometry.coordinates[0].slice(0);
    // else if (polygon.geometry.type === Constants.geojsonTypes.MULTI_POLYGON) {
    //   const temp = [];
    //   polygon.geometry.coordinates.forEach((c) => {
    //     c.forEach((c2) => {
    //       c2.forEach((c3) => {
    //         temp.push(c3);
    //       });
    //     });
    //   });
    // corners = temp;
    // } else if (polygon.geometry.type === Constants.geojsonTypes.LINE_STRING)
    //   corners = polygon.geometry.coordinates;
    // else if (
    //   polygon.geometry.type === Constants.geojsonTypes.MULTI_LINE_STRING
    // ) {
    //   const temp = [];
    //   polygon.geometry.coordinates.forEach((c) => {
    //     c.forEach((c2) => {
    //       temp.push(c2);
    //     });
    //   });
    //   corners = temp;
    // }

    const n = corners.length - 1;
    const iHalf = Math.floor(n / 2);

    const rotateCenters = [];
    const headings = [];

    for (let i1 = 0; i1 < n; i1++) {
      let i0 = i1 - 1;
      if (i0 < 0) i0 += n;

      const c0 = corners[i0];
      const c1 = corners[i1];
      if (c0 === undefined || c1 === undefined) return; // 追加ロジック
      const rotPoint = midpoint(point(c0), point(c1));

      let rotCenter: Feature<Point> = center0;
      if (scaleRotateCenter.Opposite === state.rotatePivot) {
        const i3 = (i1 + iHalf) % n; // opposite corner
        let i2 = i3 - 1;
        if (i2 < 0) i2 += n;

        const c2 = corners[i2];
        const c3 = corners[i3];
        if (c2 === undefined || c3 === undefined) return; // 追加ロジック
        rotCenter = midpoint(point(c2), point(c3));
      }

      rotateCenters[i1] = rotCenter.geometry.coordinates;
      headings[i1] = bearing(rotCenter, rotPoint);
    }

    state.rotation = {
      feature0: geojson, // initial feature state
      centers: rotateCenters,
      headings: headings, // rotation start heading for each point
    };

    // compute current distances from centers for scaling

    const scaleCenters = [];
    const distances = [];
    for (let i = 0; i < n; i++) {
      const c1 = corners[i];
      let c0: Position | undefined = center0.geometry.coordinates;
      if (scaleRotateCenter.Opposite === state.scaleCenter) {
        const i2 = (i + iHalf) % n; // opposite corner
        c0 = corners[i2];
      }
      if (c0 === undefined || c1 === undefined) return; // 追加ロジック
      scaleCenters[i] = c0;
      distances[i] = distance(point(c0), point(c1), { units: "meters" });
    }

    state.scaling = {
      feature0: geojson, // initial feature state
      centers: scaleCenters,
      distances: distances,
    };
  },

  onDrag: function (state, e) {
    if (state.canDragMove !== true) return;
    state.dragMoving = true;
    e.originalEvent.stopPropagation();

    const delta = {
      lng: e.lngLat.lng - (state.dragMoveLocation?.lng ?? 0), // 変更
      lat: e.lngLat.lat - (state.dragMoveLocation?.lat ?? 0), // 変更
    };
    if (state.selectedCoordPaths.length > 0 && state.txMode) {
      switch (state.txMode) {
        case txMode.Rotate:
          this.dragRotatePoint(state, e, delta);
          break;
        case txMode.Scale:
          this.dragScalePoint(state, e, delta);
          break;
      }
    } else {
      this.dragFeature(state, e, delta);
    }

    state.dragMoveLocation = e.lngLat;
  },

  dragRotatePoint: function (state, e, delta) {
    if (state.rotation === undefined || state.rotation == null) {
      throw new Error("state.rotation required");
    }

    const polygon = state.feature.toGeoJSON();
    const m1 = point([e.lngLat.lng, e.lngLat.lat]);

    const n = state.rotation.centers.length;
    const cIdx = (this.coordinateIndex(state.selectedCoordPaths) + 1) % n;
    // TODO validate cIdx
    const cCenter = state.rotation.centers[cIdx];
    if (cCenter === undefined) return; // 追加
    const center = point(cCenter);

    const heading1 = bearing(center, m1);

    const heading0 = state.rotation.headings[cIdx];
    if (heading0 === undefined) return; // 追加
    let rotateAngle = heading1 - heading0; // in degrees
    if (CommonSelectors.isShiftDown(e)) {
      rotateAngle = 5.0 * Math.round(rotateAngle / 5.0);
    }

    const rotatedFeature = transformRotate(
      state.rotation.feature0 as Feature<Polygon>,
      rotateAngle,
      {
        pivot: center,
        mutate: false,
      }
    );

    state.feature.incomingCoords(rotatedFeature.geometry.coordinates);
    // TODO add option for this:
    this.fireUpdate();
  },

  dragScalePoint: function (state, e, delta) {
    if (state.scaling === undefined || state.scaling == null) {
      throw new Error("state.scaling required");
    }

    const polygon = state.feature.toGeoJSON();

    const cIdx = this.coordinateIndex(state.selectedCoordPaths);
    // TODO validate cIdx

    const cCenter = state.scaling.centers[cIdx];
    if (cCenter === undefined) return; // 追加
    const center = point(cCenter);
    const m1 = point([e.lngLat.lng, e.lngLat.lat]);

    const dist = distance(center, m1, { units: "meters" });
    const cDist = state.scaling.distances[cIdx]; // 追加
    if (cDist === undefined) return; // 追加
    let scale = dist / cDist;

    if (CommonSelectors.isShiftDown(e)) {
      // TODO discrete scaling
      scale = 0.05 * Math.round(scale / 0.05);
    }

    const scaledFeature = transformScale(
      state.scaling.feature0 as Feature<Polygon>,
      scale,
      {
        origin: cCenter,
        mutate: false,
      }
    );

    state.feature.incomingCoords(scaledFeature.geometry.coordinates);
    // TODO add option for this:
    this.fireUpdate();
  },

  dragFeature: function (state, e, delta) {
    moveFeatures(this.getSelected(), delta);
    state.dragMoveLocation = e.lngLat;
    // TODO add option for this:
    this.fireUpdate();
  },

  fireUpdate: function () {
    this.map.fire(Constants.events.UPDATE, {
      action: Constants.updateActions.CHANGE_COORDINATES,
      features: this.getSelected().map((f) => f.toGeoJSON()),
    });
  },

  onMouseOut: function (state) {
    // As soon as you mouse leaves the canvas, update the feature
    if (state.dragMoving) {
      this.fireUpdate();
    }
  },

  onTouchEnd: function (state) {
    if (state.dragMoving) {
      this.fireUpdate();
    }
    this.stopDragging(state);
  },

  onMouseUp: function (state) {
    if (state.dragMoving) {
      this.fireUpdate();
    }
    this.stopDragging(state);
  },

  clickActiveFeature: function (state) {
    state.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    state.feature.changed();
  },

  onClick: function (state, e) {
    if (CommonSelectors.noTarget(e)) return this.clickNoTarget(state, e);
    if (CommonSelectors.isActiveFeature(e))
      return this.clickActiveFeature(state); // 修正
    if (CommonSelectors.isInactiveFeature(e))
      return this.clickInactive(state, e);
    this.stopDragging(state);
  },

  clickNoTarget: function (state) {
    if (state.canSelectFeatures) this.changeMode(Constants.modes.SIMPLE_SELECT);
  },

  clickInactive: function (state, e) {
    if (state.canSelectFeatures)
      this.changeMode(Constants.modes.SIMPLE_SELECT, {
        featureIds: [e.featureTarget.properties?.id],
      });
  },

  onTrash: function () {
    const selectedFeatureId = this.getSelectedIds()[0];
    if (selectedFeatureId) {
      // 追加ロジック
      this.deleteFeature(selectedFeatureId);
    }
    // this.fireActionable();
  },
};

export const ScaleRotateCenter = {
  Center: 0, // rotate or scale around center of polygon
  Opposite: 1, // rotate or scale around opposite side of polygon
};

function parseScaleRotateCenter(
  value: "center" | "opposite" | number | null | undefined,
  defaultScaleRotateCenter: number = ScaleRotateCenter.Center
) {
  if (value == undefined || value == null) return defaultScaleRotateCenter;

  if (
    value === ScaleRotateCenter.Center ||
    value === ScaleRotateCenter.Opposite
  )
    return value;

  if (value == "center") return ScaleRotateCenter.Center;

  if (value == "opposite") return ScaleRotateCenter.Opposite;

  throw Error("Invalid ScaleRotateCenter: " + value);
}

const txMode = {
  Scale: 1,
  Rotate: 2,
} as const;

export const scaleRotateCenter = {
  Center: 0, // rotate or scale around center of polygon
  Opposite: 1, // rotate or scale around opposite side of polygon
} as const;
