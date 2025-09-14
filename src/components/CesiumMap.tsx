import React from "react";
import { Viewer, CameraFlyTo, Cesium3DTileset } from "resium";
import { Cartesian3, CesiumTerrainProvider, Ion, IonResource } from "cesium";
import { MapDeviceEntity } from "./map-device-entity";



const p = { lat: 40.7331, lon: -73.9844, hae: 50 }
const p1 = { lat: 40.7941, lon: -73.9354, hae: 100 }
const p2 = { lat: 40.7951, lon: -73.9664, hae: 220 }


const CesiumMap = () => {
    const cesiumIonToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzMzBhZTlmMy00ZDQ4LTRmMGQtYjEzNy1mNWZkNTBmZTc5YmQiLCJpZCI6MjkwNjk3LCJpYXQiOjE3NDM2ODgxNDJ9.6CszVte8ux1ipX1fLH0EAVBS5L2m_lzpi0-H80Nf_LA"

    if (cesiumIonToken) {
        Ion.defaultAccessToken = cesiumIonToken;
    } else {
        console.warn('Cesium Ion Token is missing! 3D Tilesets might not load.');
    }
    const cameraPositions = Cartesian3.fromDegrees(-73.9654, 40.7831, 2500)
    const terrainProvider = cesiumIonToken && CesiumTerrainProvider.fromIonAssetId(1);

    return (
        <Viewer
            style={{ width: '100%', height: 'calc(100vh)' }}
            geocoder={false}
            animation={false}
            sceneModePicker={false}
            timeline={false}
            infoBox={false}
            fullscreenButton={false}
            selectionIndicator={false}
            terrainProvider={terrainProvider}

        >
            <CameraFlyTo
                destination={cameraPositions}
                duration={2}
                orientation={{
                    heading: 2.0,
                    pitch: -Math.PI / 10,
                    roll: 0
                }}
            />

            <MapDeviceEntity point={p} />
            <MapDeviceEntity point={p1} />
            <MapDeviceEntity point={p2} />
            <MapDeviceEntity point={p} />

            {/* <Cesium3DTileset
                url={IonResource.fromAssetId(96188)}
                onError={(error) =>
                    console.error('Failed to load buildings tileset:', error)
                }
            /> */}
            <Cesium3DTileset
                url={IonResource.fromAssetId(2275207)}
                onError={(error) =>
                    console.error('Failed to load terrain tileset:', error)
                }
            />



        </Viewer>
    );
};

export default CesiumMap;
