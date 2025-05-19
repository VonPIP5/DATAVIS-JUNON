/**
 * @file map.js
 * Module de gestion de la carte interactive avec Leaflet
 * Récupération des coordonnées, création de la carte et gestion des événements
 */

import { rotatePolygonToFaceCamera, highlightSerieByCodeBSS } from './visualisation.js';

const leafletMarkersByCodeBSS = {};

/**
 * Récupération des coordonnées des stations du département pour en calculer l'average et les retourner pour permettre la création de la carte centrée
 * @param {Array} stations - Liste des stations
 * @return {Object} - Objet contenant les coordonnées, la latitude et la longitude moyennes
 */

export function getCoordsAndAvg(stations) {
    const coords = stations
        .filter(s => s.latitude && s.longitude)
        .map(s => ({
            lat: parseFloat(s.latitude),
            lon: parseFloat(s.longitude),
            station: s
        }));

    if (coords.length === 0) return { coords: [], avgLat: 0, avgLon: 0 };

    const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
    const avgLon = coords.reduce((sum, c) => sum + c.lon, 0) / coords.length;

    return { coords, avgLat, avgLon };
}

/**
 * Création d'une carte avec Leaflet pour afficher et situer les stations
 * @param {Array} coords - Liste des coordonnées des stations
 * @param {number} avgLat - Latitude moyenne des stations
 * @param {number} avgLon - Longitude moyenne des stations
 * @throws {Error} - Si la liste des coordonnées est vide
 */

export function generateMap(coords, avgLat, avgLon) {
    const mapPanel = document.getElementById('mapPanel');
    mapPanel.innerHTML = "<div id='map' style='width: 500px; height: 500px;'></div>";

    const map = L.map('map').setView([avgLon, avgLat], 9);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>'
    }).addTo(map);

    let lastClickedMarker = null;

    coords.forEach(({ lat, lon, station }) => {
        let iconUrl = 'leaflet/images/marker-icon-2x.png';

        if (station.mesuresNappes && station.mesuresNappes.length > 0) {
            iconUrl = 'leaflet/images/marker-icon-violet.png';
        }

        const defaultIcon = L.icon({
            iconUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'leaflet/images/marker-shadow.png',
            shadowSize: [41, 41]
        });

        const redIcon = L.icon({
            iconUrl: 'leaflet/images/marker-icon-rouge.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'leaflet/images/marker-shadow.png',
            shadowSize: [41, 41]
        });

        const marker = L.marker([lon, lat], { icon: defaultIcon }).addTo(map);

        leafletMarkersByCodeBSS[station.codeBSS] = {
            marker,
            defaultIcon,
            redIcon
        };

        marker.bindPopup(`
            <b>${station.commune || 'Commune inconnue'}</b><br/>
            ${station.codeBSS}<br/>
            Altitude : ${station.altitude || 'N/A'} m
        `);

        marker.on('click', () => {
            if (lastClickedMarker) {
                lastClickedMarker.setIcon(lastClickedMarker.originalIcon);
            }

            marker.setIcon(redIcon);
            marker.originalIcon = defaultIcon;
            lastClickedMarker = marker;

            rotatePolygonToFaceCamera(station.codeBSS);
            highlightSerieByCodeBSS(station.codeBSS);
        });
    });

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-rouge.png"> <span>Station CLIQUÉE</span><br>';
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-2x.png"> <span>Station SANS infos</span><br>';
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-violet.png"> <span>Station AVEC infos</span><br>';
        return div;
    };

    legend.addTo(map);
}


export { leafletMarkersByCodeBSS }