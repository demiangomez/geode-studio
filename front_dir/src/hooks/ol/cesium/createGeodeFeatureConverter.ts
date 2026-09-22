// olcs's FeatureConverter draws polygon/line outlines with a MaterialAppearance
// (vertexFormat POSITION_NORMAL_AND_ST), but PolygonOutlineGeometry/PolylineGeometry
// with a flat color material only ever produce `position`. Cesium's shader/geometry
// validation (Primitive.js, debug-only but shipped in this build) throws on that
// mismatch — the primitive silently never renders (scene.renderError, no listener by
// default). Reproduced on Chrome/ANGLE and Firefox/ANGLE on Linux/Windows; passes on
// Mesa because the driver strips the unused attribute before validation runs.
// PerInstanceColorAppearance's flat vertex format is POSITION_ONLY, which matches.
export const createGeodeFeatureConverter = (
    FeatureConverterClass: any,
    CesiumModule: any,
    scene: any,
): any => {
    class GeodeFeatureConverter extends FeatureConverterClass {
        constructor(sceneArg: any) {
            super(sceneArg);
        }

        createColoredPrimitive(
            layer: any,
            feature: any,
            olGeometry: any,
            geometry: any,
            color: any,
            opt_lineWidth?: number,
        ) {
            if (color instanceof CesiumModule.ImageMaterialProperty) {
                return super.createColoredPrimitive(
                    layer,
                    feature,
                    olGeometry,
                    geometry,
                    color,
                    opt_lineWidth,
                );
            }

            const renderState: Record<string, unknown> = {
                depthTest: { enabled: true },
            };
            if (opt_lineWidth !== undefined) {
                renderState.lineWidth = opt_lineWidth;
            }

            const heightReference = this.getHeightReference(
                layer,
                feature,
                olGeometry,
            );
            const clampToGround =
                heightReference ===
                CesiumModule.HeightReference.CLAMP_TO_GROUND;
            if (
                clampToGround &&
                !("createShadowVolume" in geometry.constructor)
            ) {
                return null;
            }

            const instance = new CesiumModule.GeometryInstance({
                geometry,
                attributes: {
                    color: CesiumModule.ColorGeometryInstanceAttribute.fromColor(
                        color,
                    ),
                },
            });
            const appearance = new CesiumModule.PerInstanceColorAppearance({
                flat: true,
                translucent: color.alpha !== 1,
                renderState,
            });

            const primitive = clampToGround
                ? new CesiumModule.GroundPrimitive({
                      geometryInstances: instance,
                      appearance,
                  })
                : new CesiumModule.Primitive({
                      geometryInstances: instance,
                      appearance,
                  });

            if (
                primitive instanceof CesiumModule.Primitive &&
                (feature.get("olcs_shadows") || layer.get("olcs_shadows"))
            ) {
                primitive.shadows = CesiumModule.ShadowMode.ENABLED;
            }

            this.setReferenceForPicking(layer, feature, primitive);
            return primitive;
        }
    }

    return new GeodeFeatureConverter(scene);
};
