import * as Constants from "@mapbox/mapbox-gl-draw/src/constants";
import * as CommonSelectors from "@mapbox/mapbox-gl-draw/src/lib/common_selectors";
import createSupplementaryPoints from "@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points";
import doubleClickZoom from "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
import moveFeatures from "@mapbox/mapbox-gl-draw/src/lib/move_features";
import bearing from "@turf/bearing";
import center from "@turf/center";
import destination from "@turf/destination";
import distance from "@turf/distance";
import { lineString, point } from "@turf/helpers";
import midpoint from "@turf/midpoint";
import transformRotate from "@turf/transform-rotate";
import transformScale from "@turf/transform-scale";
import { LngLat } from "mapbox-gl";

import rotate from "./img/rotate.png";
import scale from "./img/scale.png";
import { DrawCustomMode } from "./types/mapbox-gl-draw";

type CustomModeState = {
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
  selectedCoordPaths: unknown[];
};

type CustomModeOptions = {
  canTrash?: boolean | undefined;
  canScale?: boolean | undefined;
  canRotate?: boolean | undefined;
  singleRotationPoint?: boolean | undefined;
  rotationPointRadius?: number | undefined;
  rotatePivot?: number | "center" | "opposite" | undefined;
  scaleCenter?: number | "center" | "opposite" | undefined;
  canSelectFeatures?: boolean | undefined;
  startPos?: LngLat;
  coordPath: unknown;
};

export const ScaleRotateMode: DrawCustomMode<
  CustomModeState,
  CustomModeOptions
> = {
  onSetup: function (opts) {
    const selectedFeature = this.getSelected()[0];

    if (!selectedFeature) {
      throw new Error("No feature is selected.");
    }

    if (selectedFeature.type !== Constants.geojsonTypes.POLYGON) {
      throw new TypeError("ScaleRotateMode can only handle 'POLYGON' feature.");
    }

    const state: CustomModeState = {
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
      this.pathsToCoordinates(selectedFeature.id, state.selectedCoordPaths)
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
};

export const ScaleRotateCenter = {
  Center: 0, // rotate or scale around center of polygon
  Opposite: 1, // rotate or scale around opposite side of polygon
};

export const ScaleRotateStyle = [
  {
    id: "gl-draw-polygon-fill-inactive",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Polygon"],
      ["!=", "user_type", "overlay"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "fill-color": "#3bb2d0",
      "fill-outline-color": "#3bb2d0",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-polygon-fill-active",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["!=", "user_type", "overlay"],
    ],
    paint: {
      "fill-color": "#fbb03b",
      "fill-outline-color": "#fbb03b",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-overlay-polygon-fill-inactive",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Polygon"],
      ["==", "user_type", "overlay"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "fill-color": "#3bb2d0",
      "fill-outline-color": "#3bb2d0",
      "fill-opacity": 0.01,
    },
  },
  {
    id: "gl-draw-overlay-polygon-fill-active",
    type: "fill",
    filter: [
      "all",
      ["==", "active", "true"],
      ["==", "$type", "Polygon"],
      ["==", "user_type", "overlay"],
    ],
    paint: {
      "fill-color": "#fbb03b",
      "fill-outline-color": "#fbb03b",
      "fill-opacity": 0.01,
    },
  },
  {
    id: "gl-draw-polygon-stroke-inactive",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Polygon"],
      ["!=", "user_type", "overlay"],
      ["!=", "mode", "static"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3bb2d0",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fbb03b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: {
      "circle-radius": 3,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-line-inactive",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "LineString"],
      ["!=", "mode", "static"],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3bb2d0",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-active",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fbb03b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-stroke-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 4,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 2,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-scale-icon",
    type: "symbol",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
      ["has", "heading"],
    ],
    layout: {
      "icon-image": "scale",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotation-alignment": "map",
      "icon-rotate": ["get", "heading"],
    },
    paint: {
      "icon-opacity": 1.0,
      "icon-opacity-transition": {
        delay: 0,
        duration: 0,
      },
    },
  },
  {
    id: "gl-draw-point-point-stroke-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Point"],
      ["==", "meta", "feature"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 5,
      "circle-opacity": 1,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-point-inactive",
    type: "circle",
    filter: [
      "all",
      ["==", "active", "false"],
      ["==", "$type", "Point"],
      ["==", "meta", "feature"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 3,
      "circle-color": "#3bb2d0",
    },
  },
  {
    id: "gl-draw-point-stroke-active",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["==", "active", "true"],
      ["!=", "meta", "midpoint"],
    ],
    paint: {
      "circle-radius": 4,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-point-active",
    type: "circle",
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["!=", "meta", "midpoint"],
      ["==", "active", "true"],
    ],
    paint: {
      "circle-radius": 2,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-polygon-fill-static",
    type: "fill",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
    paint: {
      "fill-color": "#404040",
      "fill-outline-color": "#404040",
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-stroke-static",
    type: "line",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#404040",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-static",
    type: "line",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "LineString"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#404040",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-point-static",
    type: "circle",
    filter: ["all", ["==", "mode", "static"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#404040",
    },
  },
  // {
  //     'id': 'gl-draw-polygon-rotate-point',
  //     'type': 'circle',
  //     'filter': ['all',
  //         ['==', '$type', 'Point'],
  //         ['==', 'meta', 'rotate_point']],
  //     'paint': {
  //         'circle-radius': 5,
  //         'circle-color': '#fbb03b'
  //     }
  // },
  {
    id: "gl-draw-line-rotate-point",
    type: "line",
    filter: [
      "all",
      ["==", "meta", "midpoint"],
      ["==", "icon", "rotate"],
      ["==", "$type", "LineString"],
      ["!=", "mode", "static"],
      // ['==', 'active', 'true']
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#fbb03b",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-rotate-point-stroke",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "midpoint"],
      ["==", "icon", "rotate"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 4,
      "circle-color": "#fff",
    },
  },
  {
    id: "gl-draw-polygon-rotate-point",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "midpoint"],
      ["==", "icon", "rotate"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 2,
      "circle-color": "#fbb03b",
    },
  },
  {
    id: "gl-draw-polygon-rotate-point-icon",
    type: "symbol",
    filter: [
      "all",
      ["==", "meta", "midpoint"],
      ["==", "icon", "rotate"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    layout: {
      "icon-image": "rotate",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotation-alignment": "map",
      "icon-rotate": ["get", "heading"],
    },
    paint: {
      "icon-opacity": 1.0,
      "icon-opacity-transition": {
        delay: 0,
        duration: 0,
      },
    },
  },
];

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
