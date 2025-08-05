import React from "react";
import { Viewer, Entity, ModelGraphics, CameraFlyTo, Cesium3DTileset } from "resium";
import { Cartesian3, CesiumTerrainProvider, Color, Ion, IonResource } from "cesium";
import { MapDeviceEntity } from "./map-device-entity";



const p = { lat: 31.7683, lon: 35.2137, hae: 250 }
const p1 = { lat: 31.7783, lon: 35.2137, hae: 1000 }
const p2 = { lat: 31.7883, lon: 35.2137, hae: 520 }


const CesiumMap = () => {
    const cesiumIonToken = "" //add token

    if (cesiumIonToken) {
        Ion.defaultAccessToken = cesiumIonToken;
    } else {
        console.warn('Cesium Ion Token is missing! 3D Tilesets might not load.');
    }
    const cameraPositions = Cartesian3.fromDegrees(35.2137, 31.7783, 5000)
    const terrainProvider =
        cesiumIonToken && CesiumTerrainProvider.fromIonAssetId(3131788);

    return (
        <Viewer
            style={{ width: '100%', height: 'calc(100vh - 64px)' }}
            geocoder={false}
            animation={false}
            sceneModePicker={false}
            timeline={false}
            homeButton={false}
            infoBox={false}
            fullscreenButton={false}
            navigationHelpButton={false}
            selectionIndicator={false}
            terrainProvider={terrainProvider}

        >
            <CameraFlyTo
                destination={cameraPositions}
                duration={0}
            />
            {cesiumIonToken && (
                <>
                    <Cesium3DTileset
                        url={IonResource.fromAssetId(96188)}
                        onError={(error) =>
                            console.error('Failed to load buildings tileset:', error)
                        }
                    />
                    <Cesium3DTileset
                        url={IonResource.fromAssetId(3135461)}
                        onError={(error) =>
                            console.error('Failed to load terrain tileset:', error)
                        }
                    />
                    {/* Gan Shomron */}
                    <Cesium3DTileset
                        url={IonResource.fromAssetId(3591070)}
                        onError={(error) =>
                            console.error('Failed to load terrain tileset:', error)
                        }
                    />
                </>
            )}

            <MapDeviceEntity point={p} />
            <MapDeviceEntity point={p1} />
            <MapDeviceEntity point={p2} />


        </Viewer>
    );
};

export default CesiumMap;
