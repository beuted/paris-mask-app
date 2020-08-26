import React, { useEffect, useState } from 'react';
import './App.css';
import Map from 'ol/Map';
import View from 'ol/View';
import Tile from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import Geolocation from 'ol/Geolocation';
import {getVectorContext} from 'ol/render';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import * as turf from '@turf/turf'

const maskZoneStyle =
  new Style({
    fill: new Fill({
      color: 'rgba(0, 0, 255, 0.3)',
    }),
  });

  const geoMarkerStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({color: 'black'}),
    stroke: new Stroke({
      color: 'white',
      width: 2,
    }),
  })
});

function App() {
  const [shouldWearMask, setShouldWearMask] = useState(false);

  const init = async () => {
    let polygones = await fetchMaskZones();

    let geojsonObject = {
      'type': 'FeatureCollection',
      'crs': {
        'type': 'name',
        'properties': {
          'name': 'EPSG:3857', //EPSG:3857
          'center': [0, 0],
        },
      },
      'features': [
        {
          'type': 'Feature',
          'geometry': {
            'type': 'Polygon',
            'coordinates':
              polygones,
          },
        },
      ]
    };

    var maskZonesVectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geojsonObject),
    });

    var maskZonesLayer = new VectorLayer({
      source: maskZonesVectorSource,
      style: maskZoneStyle,
    });

    var geolocation = new Geolocation({
      // enableHighAccuracy must be set to true to have the heading value.
      trackingOptions: {
        enableHighAccuracy: true,
      },
      projection: 'EPSG:3857',
    });

    geolocation.setTracking(true);

    // update the HTML page when the position changes.
    geolocation.on('change', function () {
      let position = geolocation.getPosition();
      if (!position)
        return;
      var pt = turf.point(position);
      var poly = turf.polygon(polygones);

      var isInZone = turf.booleanPointInPolygon(pt, poly)

      //vibrate on transition
      if (isInZone && !shouldWearMask)
        window.navigator.vibrate(300);

      setShouldWearMask(isInZone);
    });

    // handle geolocation error.
    geolocation.on('error', function (error) {
     console.warn('geolocation error', error);
    });

    const source = new OSM();

    var map = new Map({
      target: 'map',
      layers: [
        new Tile({
          source: source
        }),
        maskZonesLayer,
      ],
      view: new View({
        projection: 'EPSG:3857',
        center: fromLonLat([2.3488, 48.8534]),
        zoom: 13
      }),
      controls: []
    });

    maskZonesLayer.on('postrender', (event) => drawPosition(event, geolocation));
  }

  useEffect(() => {
    init();
  }, []);

  return (
    <div className="App">
      <div id="map" className="map"></div>
      <header className={ (shouldWearMask ? 'mask-on' : 'mask-off') + ' app-header' }>
        zones de port du masque
      </header>
    </div>
  );
}

async function fetchMaskZones() {
  var response = await fetch("https://opendata.paris.fr/api/records/1.0/search/?dataset=coronavirus-port-du-masque-obligatoire-lieux-places-et-marches&q=&rows=100&facet=nom_long&facet=ardt");
  var res = await response.json();
  return res.records.map(record => record.fields.geo_shape.coordinates[0].map(x => (fromLonLat(x))));
}

function drawPosition(event, geolocation) {
  let position = geolocation.getPosition();
  if (!position)
    return;
  var vectorContext = getVectorContext(event);
  var currentPoint = new Point(position);
  var feature = new Feature(currentPoint);
  vectorContext.drawFeature(feature, geoMarkerStyle);
};

export default App;
