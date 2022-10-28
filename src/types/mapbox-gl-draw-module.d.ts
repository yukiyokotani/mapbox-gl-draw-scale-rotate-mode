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
}
declare module "@mapbox/mapbox-gl-draw/src/lib/common_selectors";
declare module "@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points";
declare module "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
declare module "@mapbox/mapbox-gl-draw/src/lib/move_features";
