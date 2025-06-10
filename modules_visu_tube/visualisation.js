/**
 * @file visualisation.js
 * Module de visualisation 3D avec A-Frame
 * Gère le polygone 3D et les éléments de visualisation
 */

import { departementStationsInformations, getMaxDataCount, getMinMaxValues, getAllDates, getCoordsAndAvg } from './data.js';
import { infoPanel, graphiquePanel, colorBegin, colorEnd } from '../visuApiMain.js';
import { generateMap, leafletMarkersByCodeBSS } from './map.js';

let color_begin;
let color_end;

let currentHighlight = null;

let lastClickedLeafletMarker = null;

const camera = document.querySelector('#camera');
const step = 0.2;

/**
 * Convertir une couleur hexadécimale en tableau comportant les valeurs RGB
 * @param {string} hex - La couleur hexadécimale à convertir
 * @return {Array} - Un tableau contenant les valeurs RGB 
 */

function hexToRgbArray(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255,
        (bigint >> 8) & 255,
        bigint & 255
    ];
}

/**
 * Enregistre le composant A-Frame polygon
 */
export function registerPolygonComponent() {

    color_begin = hexToRgbArray(colorBegin.value); // Rouge
    color_end = hexToRgbArray(colorEnd.value); // Bleu

    /**
     * Créer le polygone support des données de mesure
     * @type {AFRAME.Component}
     * @description Composant A-Frame pour créer un polygone 3D représentant les données de niveaux de nappes
     */

    AFRAME.registerComponent('polygon', {
        schema: {
            sides: { type: 'int', default: 3, min: 3 },
            depth: { type: 'number', default: 1, min: 1 }
        },

        /** 
         * Set le nombre de côtés en fonction du nombre de séries de données
         * @param {number} sides - Nombre de côtés du polygone
         * @param {number} depth - Profondeur du polygone
         */

        init: function () {
            document.addEventListener('stationsDataLoaded', () => {
                const stations = departementStationsInformations.stations;
                const sides = stations.length;
                this.updatePolygon(sides);

                const { coords, avgLat, avgLon } = getCoordsAndAvg(stations);
                generateMap(coords, avgLat, avgLon);
            });
        },

        /**
         * Met à jour le polygone en fonction du nombre de côtés et de la profondeur
         * @param {number} sides - Nombre de côtés du polygone
         */

        updatePolygon: function (sides) {

            // Supprimer tous les enfants A-Frame DOM
            while (this.el.firstChild) {
                this.el.removeChild(this.el.firstChild);
            }

            // Supprimer le mesh principal s'il existe
            const oldMesh = this.el.getObject3D('mesh');
            if (oldMesh) {
                oldMesh.geometry?.dispose();
                oldMesh.material?.dispose();
                this.el.removeObject3D('mesh');
            }

            // Supprimer les objets 3D ajoutés (rectangles, contours, labels 3D etc.)
            const obj3D = this.el.object3D;
            while (obj3D.children.length > 0) {
                const child = obj3D.children[0];
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                obj3D.remove(child);
            }

            const maxDataCount = getMaxDataCount(departementStationsInformations.stations);
            const seriesMinMax = getMinMaxValues(
                departementStationsInformations.stations.map(station =>
                    station.mesuresNappes.map(mesure => mesure.niveauNappe)
                )
            );

            const shape = new THREE.Shape();
            const angleStep = (Math.PI * 2) / sides;
            const radius = 2;

            for (let i = 0; i < sides; i++) {
                const x = Math.cos(i * angleStep) * radius;
                const y = Math.sin(i * angleStep) * radius;
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.lineTo(radius, 0); // Fermer le polygone

            const extrudeSettings = { depth: -maxDataCount / 4, bevelEnabled: false };
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const material = new THREE.MeshStandardMaterial({
                color: '#000000',
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = Math.PI / 2;

            // Rotation face caméra
            const camera = document.querySelector('[camera]');
            if (camera) {
                const cameraWorldPos = new THREE.Vector3();
                camera.object3D.getWorldPosition(cameraWorldPos);
                const polygonWorldPos = new THREE.Vector3();
                this.el.object3D.getWorldPosition(polygonWorldPos);

                const angleToCamera = Math.atan2(
                    cameraWorldPos.z - polygonWorldPos.z,
                    cameraWorldPos.x - polygonWorldPos.x
                );
                const firstFaceOffset = angleStep / 2;
                mesh.rotation.y = -angleToCamera + firstFaceOffset;
            }

            this.el.setObject3D('mesh', mesh);
            this.createDataRectangles(sides, maxDataCount, seriesMinMax, radius);
        },


        /**
         * Création de rectangles représentant les données de niveaux de nappes pour chaque station
         * @param {number} sides - Nombre de côtés du polygone
         * @param {number} maxDataCount - Nombre maximum de données pour chaque station
         * @param {Array} seriesMinMax - Liste des objets contenant les valeurs min et max de chaque série
         * @param {number} radius - Rayon du polygone
         * @throws {Error} - Si le nombre de côtés est inférieur à 3
         * @throws {Error} - Si le nombre de données est inférieur à 1
         */

        createDataRectangles: function (sides, maxDataCount, seriesMinMax, radius) {
            const angleStep = (Math.PI * 2) / sides;
            const sideLength = 2 * radius * Math.sin(Math.PI / sides);

            const allDates = getAllDates(departementStationsInformations.stations);

            for (let i = 0; i < sides; i++) {
                const stationInformations = departementStationsInformations.stations[i];
                const serie = stationInformations?.mesuresNappes;
                if (!serie) continue;

                const serieMap = new Map(serie.map(m => [m.date, m]));
                const alignedSerie = allDates.map(date => serieMap.get(date) || null);
                const dataCount = alignedSerie.length;

                const { min, max } = seriesMinMax[i];

                const angle = i * angleStep;
                const nextAngle = (i + 1) * angleStep;

                const startX = Math.cos(angle) * radius;
                const startZ = Math.sin(angle) * radius;
                const endX = Math.cos(nextAngle) * radius;
                const endZ = Math.sin(nextAngle) * radius;

                const dirX = endX - startX;
                const dirZ = endZ - startZ;

                /**
                * Affichage des du code BSS de la station à la base de la série de mesures
                */

                const labelDistance = 0.33;
                const labelHeight = 0.1;

                const labelX = startX + dirX * labelDistance;
                const labelZ = startZ + dirZ * labelDistance;
                const labelY = labelHeight;

                const angleRad = Math.atan2(dirZ, dirX);
                const angleDeg = -THREE.MathUtils.radToDeg(angleRad);

                const labelEntity = document.createElement('a-entity');
                labelEntity.setAttribute("id", "codeBSSLabel");
                labelEntity.setAttribute('class', 'clickable');
                labelEntity.setAttribute('position', `${labelX} ${labelY} ${labelZ}`);
                labelEntity.setAttribute('rotation', `-90 ${angleDeg} -90`);
                labelEntity.setAttribute('text', {
                    font: "./custom-font-a-Frame/custom-a-frame.fnt",
                    value: stationInformations.codeBSS || null,
                    color: '#c6d0d4',
                    align: 'left',
                    width: 4,
                    baseline: 'bottom',
                    wrapCount: 40
                });

                labelEntity.addEventListener('click', () => {
                    console.log('Label BSS cliqué !');
                    highlightSerieByCodeBSS(stationInformations.codeBSS);
                    rotatePolygonToFaceCamera(stationInformations.codeBSS);
                });

                this.el.appendChild(labelEntity);

                for (let j = 0; j < dataCount; j++) {
                    const dataPoint = alignedSerie[j];

                    // on saute les mesures manquantes, donc espace vide
                    if (!dataPoint || dataPoint.niveauNappe === null || isNaN(dataPoint.niveauNappe)) {
                        continue;
                    }

                    const value = dataPoint.niveauNappe;

                    const height = 0.25;
                    const width = sideLength;
                    const depth = 0.01;
                    const posY = j * height + height / 2;

                    const [r, g, b] = echelleCouleur(color_begin, color_end, min, max, value);
                    const color = `rgb(${r}, ${g}, ${b})`;

                    const rectangleGeometry = new THREE.BoxGeometry(width, height, depth);
                    const rectangleMaterial = new THREE.MeshStandardMaterial({
                        color: color,
                    });

                    const rectangle = new THREE.Mesh(rectangleGeometry, rectangleMaterial);

                    const progress = 0.5;
                    const posX = startX + dirX * progress;
                    const posZ = startZ + dirZ * progress;

                    rectangle.position.set(posX, posY, posZ);
                    rectangle.rotation.y = -Math.atan2(dirZ, dirX);

                    rectangle.el = document.createElement('a-entity');
                    rectangle.el.setObject3D('mesh', rectangle);
                    rectangle.el.setAttribute('click-listener', '');

                    const rectangleInformations = {
                        infosStation: {
                            commune: stationInformations?.commune || null,
                            codeBSS: stationInformations?.codeBSS || null,
                            latitude: stationInformations?.latitude || null,
                            longitude: stationInformations?.longitude || null,
                            altitude: stationInformations?.altitude || null,
                            profondeurNappe: dataPoint?.profondeurNappe || null,
                            date_mesure: dataPoint?.date || null,
                            niveauNappe: value || null,
                            niveauMin: min || null,
                            niveauMax: max || null
                        }
                    };
                    rectangle.userData = rectangleInformations;

                    this.el.appendChild(rectangle.el);
                    this.el.object3D.add(rectangle);
                }
            }
        }
    });

    let previousHighlight = null;

    /**
    * Affichage des informations de la station associée au rectangle où l'on souhaite cliquer
    */

    AFRAME.registerComponent('click-listener', {
        init: function () {
            this.el.addEventListener('click', () => {
                const mesh = this.el.getObject3D('mesh');
                const data = mesh?.userData;

                // Appliquer une couleur sur la mesure sélectionnée + mise à jour si l'on clique sur une autre mesure
                if (previousHighlight && previousHighlight.parent) {
                    previousHighlight.parent.remove(previousHighlight);
                    previousHighlight = null;
                }

                if (mesh) {
                    const outlineGeometry = mesh.geometry.clone();
                    const outlineMaterial = new THREE.MeshBasicMaterial({
                        color: '#ffffff',
                        opacity: 0.3,
                        transparent: true,
                        depthWrite: false,
                    });

                    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
                    outline.scale.set(1.1, 1.1, 1.1);
                    mesh.parent.add(outline);

                    const scale = 1.1;
                    outline.scale.set(scale, scale, scale);
                    outline.position.copy(mesh.position);
                    outline.rotation.copy(mesh.rotation);

                    mesh.parent.add(outline);

                    previousHighlight = outline;
                }

                infoPanel.style.display = 'block';

                if (!data) {
                    infoPanel.innerHTML = `<h1>Aucune donnée récupérée.</h1>`;
                    console.error("Aucune donnée récupérée.");
                    return;
                }

                const info = data.infosStation;

                highlightSerieByCodeBSS(info.codeBSS);
                rotatePolygonToFaceCamera(info.codeBSS);

                infoPanel.innerHTML = `
                        <h2> ${info.commune} </h2>
                        <p><span class='bold'>Code BSS:</span> ${info.codeBSS} </p>
                        <p><span class='bold'>Coordonnées:</span> ${info.longitude}, ${info.latitude} </p>
                        <p><span class='bold'>Altitude:</span> ${info.altitude} mètres</p>
                        <p><span class='bold'>Profondeur:</span> ${info.profondeurNappe} mètres</p>
                        <hr/>
                        <h3 class='bold'>Mesures</h3>
                        <p><span class='bold'>Date de la mesure:</span> ${info.date_mesure} </p>
                        <p><span class='bold'>Niveau de la nappe:</span> ${info.niveauNappe} mètres</p>
                        <p><span class='bold'>Niveau minimum sur l'intervalle:</span> ${info.niveauMin} mètres</p>
                        <p><span class='bold'>Niveau maximum sur l'intervalle:</span> ${info.niveauMax} mètres</p>
                    `;
            });
        }
    });
}

/**
 * Calculer la l'échelle de couleur pour les mesures
 * @param {Array} color_begin - Couleur de début: rouge (RGB)
 * @param {Array} color_end - Couleur de fin: bleu (RGB)
 * @param {number} min - Valeur minimale de la série de données
 * @param {number} max - Valeur maximale de la série de données
 * @param {number} value - Valeur à coloriser
 * @return {Array} - Couleur calculée (RGB)
 */

export function echelleCouleur(color_begin, color_end, min, max, value) {
    let [r1, g1, b1] = color_begin;
    let [r2, g2, b2] = color_end;

    // Si une seule valeur se trouve dans la série de données, on renvoie la couleur égale à la valeur la plus haute
    if (min === max) return [r2, g2, b2];

    const t = (value - min) / (max - min);

    const r = Math.floor(r1 * (1 - t) + r2 * t);
    const g = Math.floor(g1 * (1 - t) + g2 * t);
    const b = Math.floor(b1 * (1 - t) + b2 * t);

    return [r, g, b];
}

/**
 * Coloriser en blanc la série de mesures sélectionnée
 * @param {string} codeBSS - Le code BSS de la station à afficher
 */

export function highlightSerieByCodeBSS(codeBSS) {
    const meshGroup = document.querySelector('[polygon]');
    if (!meshGroup) {
        console.error('Pas trouvé [polygon]');
        return;
    }

    if (currentHighlight && currentHighlight.parent) {
        currentHighlight.parent.remove(currentHighlight);
        currentHighlight = null;
    }

    const heightPerMeasure = 0.25;

    departementStationsInformations.stations.forEach((station, index) => {
        if (station.codeBSS !== codeBSS) return;

        const stactionCible = station;
        const serie = stactionCible.mesuresNappes;

        const angleStep = (Math.PI * 2) / departementStationsInformations.stations.length;
        const angle = index * angleStep;
        const nextAngle = (index + 1) * angleStep;

        const radius = 2;
        const startX = Math.cos(angle) * radius;
        const startZ = Math.sin(angle) * radius;
        const endX = Math.cos(nextAngle) * radius;
        const endZ = Math.sin(nextAngle) * radius;

        const dirX = endX - startX;
        const dirZ = endZ - startZ;

        const midX = startX + dirX * 0.5;
        const midZ = startZ + dirZ * 0.5;

        const allDates = getAllDates(departementStationsInformations.stations);
        const totalHeight = allDates.length * 0.25;

        // Highlight en contour blanc
        const highlightGeometry = new THREE.BoxGeometry(
            2 * radius * Math.sin(Math.PI / departementStationsInformations.stations.length),
            totalHeight,
            0.015
        );

        const highlightEdges = new THREE.EdgesGeometry(highlightGeometry);
        const highlightMaterial = new THREE.LineBasicMaterial({
            color: '#FFFFFF',
            linewidth: 2
        });

        const outline = new THREE.LineSegments(highlightEdges, highlightMaterial);

        outline.position.set(midX, totalHeight / 2, midZ);
        outline.rotation.y = -Math.atan2(dirZ, dirX);

        meshGroup.object3D.add(outline);
        currentHighlight = outline;

        if (lastClickedLeafletMarker) {
            const previous = leafletMarkersByCodeBSS[lastClickedLeafletMarker];
            if (previous) previous.marker.setIcon(previous.defaultIcon);
        }

        if (leafletMarkersByCodeBSS[codeBSS]) {
            const { marker, redIcon } = leafletMarkersByCodeBSS[codeBSS];
            marker.setIcon(redIcon);
            lastClickedLeafletMarker = codeBSS;
        }

        const allLabels = document.querySelectorAll('[id="codeBSSLabel"]');

        allLabels.forEach(label => {
            const textAttr = label.getAttribute('text');
            const labelText = textAttr?.value;

            label.setAttribute('text', {
                ...textAttr,
                color: labelText === codeBSS ? '#FFFFFF' : '#c6d0d4'
            });
        });
    });
}

/**
 * Faire tourner le polygone pour qu'il fasse face à la caméra
 * @param {string} codeBSS - Le code BSS de la station à afficher
 */

export function rotatePolygonToFaceCamera(codeBSS) {
    const polygon = document.querySelector('[polygon]');
    const camera = document.querySelector('[camera]');
    if (!polygon || !camera) return;

    const stationIndex = departementStationsInformations.stations.findIndex(
        station => station.codeBSS === codeBSS
    );
    if (stationIndex === -1) return;

    const sides = departementStationsInformations.stations.length;
    const angleStep = (2 * Math.PI) / sides;
    const faceStep = 0.1;

    const faceAngle = (stationIndex * angleStep) + faceStep;

    const cameraPos = new THREE.Vector3();
    camera.object3D.getWorldPosition(cameraPos);
    const polygonPos = new THREE.Vector3();
    polygon.object3D.getWorldPosition(polygonPos);
    const cameraDirection = new THREE.Vector3()
        .subVectors(cameraPos, polygonPos)
        .normalize();
    const cameraAngle = Math.atan2(cameraDirection.z, cameraDirection.x);

    const targetRotation = Math.PI - cameraAngle + faceAngle + Math.PI;

    const startRotation = polygon.object3D.rotation.y;
    const delta = ((targetRotation - startRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
    const duration = 1000;
    let startTime = null;

    function animate(time) {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const easedProgress = easeInOutBack(progress);

        polygon.object3D.rotation.y = startRotation + (delta * easedProgress);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    function easeInOutBack(t) {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;

        return t < 0.5
            ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
            : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }

    requestAnimationFrame(animate);
}

/**
 * Réinitialise la mise en évidence des labels
 */
export function resetLabelHighlight() {
    const allLabels = document.querySelectorAll('[id="codeBSSLabel"]');
    allLabels.forEach(label => {
        const textAttr = label.getAttribute('text');
        label.setAttribute('text', {
            ...textAttr,
            color: '#c6d0d4'
        });
    });
}

window.addEventListener('keydown', (e) => {
    const position = camera.getAttribute('position');

    if (e.code === 'Space') {
        position.y += step;
        camera.setAttribute('position', position);
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        position.y -= step;
        camera.setAttribute('position', position);
    }
});

/**
 * Remplacer les couleurs des mesures minimum et maximum par les nouvelles lorsque l'on en sélectionne une
 * @param {string} newColorBegin 
 * @param {string} newColorEnd 
 */

export function updatePolygonColors(newColorBegin, newColorEnd) {
    const polygonEl = document.querySelector('[polygon]');
    if (!polygonEl) return;

    const polygonComponent = polygonEl.components.polygon;
    if (!polygonComponent) return;

    color_begin = hexToRgbArray(newColorBegin);
    color_end = hexToRgbArray(newColorEnd);

    polygonComponent.updatePolygon(departementStationsInformations.stations.length);
}