import React, { useEffect, useState } from 'react';
import './App.css';
import Map from 'ol/Map';
import View from 'ol/View';
import Tile from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat, getPointResolution } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import Geolocation from 'ol/Geolocation';
import {getVectorContext} from 'ol/render';
import Point from 'ol/geom/Point';
import Circle from 'ol/geom/Circle';

import Feature from 'ol/Feature';
import * as turf from '@turf/turf'


function App() {
  const [zoneOk, setZoneOk] = useState(false);
  const [showInstallPromotion, setShowInstallPromotion] = useState(false);
  const [circleCenter, setCircleCenter] = useState(null);
  const [position, setPosition] = useState(null);
  const [geolocation, setGeolocation] = useState(null);
  const [circleLayer, setCircleLayer] = useState(null);
  const [map, setMap] = useState(null);

  const init = async () => {
    const source = new OSM();
    const tileLayer = new Tile({
      source: source
    });

    const circleLayer = drawCircleInMeter(fromLonLat([2.337242, 48.857351]), 1200);

    var map = new Map({
      target: 'map',
      layers: [
        tileLayer,
        //maskZonesLayer,
        circleLayer
      ],
      view: new View({
        projection: 'EPSG:3857',
        center: fromLonLat([2.3488, 48.8534]),
        zoom: 13
      }),
      controls: []
    });

    var geolocation = new Geolocation({
      // enableHighAccuracy must be set to true to have the heading value.
      trackingOptions: {
        enableHighAccuracy: true,
      },
      projection: 'EPSG:3857',
    });

    tileLayer.on('postrender', (event) => drawPosition(event, geolocation /*geolocation*/ ));

    setGeolocation(geolocation);
    setCircleLayer(circleLayer);
    setMap(map);
  }

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!geolocation || geolocation.getTracking())
      return;

    geolocation.setTracking(true);

    // update the HTML page when the position changes.
    geolocation.on('change', () => {
      setPosition(geolocation.getPosition());
    });

    // handle geolocation error.
    geolocation.on('error', function (error) {
      console.warn('geolocation error', error);
    });
  }, [geolocation, map]);

  useEffect(() => {
    if (circleCenter)
      changeCirclePosition(circleCenter, 1500, circleLayer);
  }, [circleCenter, circleLayer]);

  useEffect(() => {
    if (!position || !circleCenter)
      return;

    const pt1 = turf.point(toLonLat(position));
    const pt2 = turf.point(toLonLat(circleCenter));
    const distance = turf.distance(pt1, pt2);
    const isInZone = distance < 1;

    //vibrate on transition
    if (isInZone && !zoneOk)
      window.navigator.vibrate(300);

    setZoneOk(isInZone);

    map.render();
  }, [position, circleCenter])


  ///////////////////////
  //PWA stuff to be moved

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    setShowInstallPromotion(true);
  });

  function installPwa() {
    // Hide the app provided install promotion
    setShowInstallPromotion(false);
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
    });
  }

  function changeCirclePositionWithCurrentPosition() {
    setCircleCenter(geolocation.getPosition());
  }

  return (
    <div className="app">
      <div id="map" className="map"></div>
      <header className={ (zoneOk ? 'zone-ok' : 'zone-nok') + ' app-header' }></header>
      <div className="use-position" onClick={changeCirclePositionWithCurrentPosition}>Use Position</div>
      {showInstallPromotion ? <footer className='install-footer' onClick={installPwa}>Install as an App</footer> : null}

    </div>
  );
}


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


var drawCircleInMeter = (pos, radius) => {
  var circle = new Circle(pos, radius);
  var circleFeature = new Feature(circle);
  var vectorSource = new VectorSource({
    features: [circleFeature],
    projection: 'EPSG:3857',
  });

  return new VectorLayer({
    source: vectorSource,
    style: [
    new Style({
        stroke: new Stroke({
            color: 'blue',
            width: 3
        }),
        fill: new Fill({
            color: 'rgba(0, 0, 255, 0.1)'
        })
    })]
  });
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

var changeCirclePosition = function(center, radius, circleLayer) {
  var circle = new Circle(center, radius);
  var circleFeature = new Feature(circle);
  circleLayer.getSource().clear();
  circleLayer.getSource().addFeatures([circleFeature]);
};


//Test lat long : (48.857351 , 2.337242)

export default App;
