declare module "@mapbox/mapbox-gl-draw/src/constants" {
  const geojsonTypes = {
    FEATURE: "Feature",
    POLYGON: "Polygon",
    LINE_STRING: "LineString",
    POINT: "Point",
    FEATURE_COLLECTION: "FeatureCollection",
    MULTI_PREFIX: "Multi",
    MULTI_POINT: "MultiPoint",
    MULTI_LINE_STRING: "MultiLineString",
    MULTI_POLYGON: "MultiPolygon",
  } as const;

  const activeStates = {
    ACTIVE: "true",
    INACTIVE: "false",
  } as const;

  const meta = {
    FEATURE: "feature",
    MIDPOINT: "midpoint",
    VERTEX: "vertex",
  } as const;

  const events = {
    CREATE: "draw.create",
    DELETE: "draw.delete",
    UPDATE: "draw.update",
    SELECTION_CHANGE: "draw.selectionchange",
    MODE_CHANGE: "draw.modechange",
    ACTIONABLE: "draw.actionable",
    RENDER: "draw.render",
    COMBINE_FEATURES: "draw.combine",
    UNCOMBINE_FEATURES: "draw.uncombine",
  } as const;

  const updateActions = {
    MOVE: "move",
    CHANGE_COORDINATES: "change_coordinates",
  } as const;

  const modes = {
    DRAW_LINE_STRING: "draw_line_string",
    DRAW_POLYGON: "draw_polygon",
    DRAW_POINT: "draw_point",
    SIMPLE_SELECT: "simple_select",
    DIRECT_SELECT: "direct_select",
    STATIC: "static",
  } as const;
}
declare module "@mapbox/mapbox-gl-draw/src/lib/common_selectors";
declare module "@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points" {
  export default function (
    geojson: GeoJSON,
    options: unknown,
    basePath?: unknown
  ): GeoJSON[];
}
declare module "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
declare module "@mapbox/mapbox-gl-draw/src/lib/move_features";
