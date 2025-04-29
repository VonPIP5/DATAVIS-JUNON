/** Ressources des API Hub'eau
 * API données des stations sur la durée du 10/03/2025 au 20/03/2025 (période de test)
 * Données des stations
 * https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?code_departement=&41&date_debut_mesure=2025-03-10&date_fin_mesure=2025-03-20
 * Données des mesures des stations
 * https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques?code_bss=03627X0052/P1&date_debut_mesure=2025-03-10&date_fin_mesure=2025-03-20
 */

/**
 * Déclaration des variables
 */

const stationsData = JSON.parse(sessionStorage.getItem('stationsData'));

let dateDebut = stationsData.dateDebut;
let dateFin = stationsData.dateFin;

const departementStationsInformations = {
    stations: []
};

let currentHighlight = null;

let searchInput = document.getElementById('searchInput');
let searchButton = document.getElementById('search');
let resetButton = document.getElementById('reset');

let baseInfosPannel = document.getElementById('baseInfosPanel')
let infoPanel = document.getElementById('infoPanel');

let color_begin = [216, 31, 7]; // Rouge
let color_end = [0, 209, 233];  // Bleu

let latitude;
let longitude;

const leafletMarkersByCodeBSS = {};
let lastClickedLeafletMarker = null;

/**
 * Fonctions permettant la création du tube de données et tout ce qui en suit
 */

/**
 * Récupérer le nombre maximum de données pour chaque station
 * @param {Array} stations - Liste des stations
 * @return {number} - Nombre maximum de données pour chaque station
 */

function getMaxDataCount(stations) {
    return Math.max(...stations.map(station => station.mesuresNappes.length));
}

/**
 * Récupérer les valeurs min et max de chaque série de données
 * @param {Array} data - Liste des séries de données
 * @return {Array} - Liste des objets contenant les valeurs min et max de chaque série
 */

function getMinMaxValues(data) {
    return data.map(serie => {
        return {
            min: Math.min(...serie),
            max: Math.max(...serie)
        };
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

function echelleCouleur(color_begin, color_end, min, max, value) {
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
 * Normaliser les dates pour l'affichage
 * @param {Array} stations - Liste des stations
 * @return {Array} - Liste des dates uniques triées
 */

function getAllDates(stations) {
    const dateSet = new Set();
    stations.forEach(station => {
        station.mesuresNappes.forEach(m => {
            if (m.date) dateSet.add(m.date);
        });
    });
    return Array.from(dateSet).sort((a, b) => {
        const toSortable = d => d.split('-').reverse().join('-');
        return toSortable(a) > toSortable(b) ? 1 : -1;
    });
}

/**
 * Inverser la date s'il le faut
 * @param {string} date - Date au format YYYY-MM-DD
 * @return {string} - Date au format DD-MM-YYYY
 */

function invertDate(date) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
}

/**
 * Calcul de la distance euclidienne entre deux coordonnées de stations
 * @param {number} lon1 - Longitude de la première station
 * @param {number} lat1 - Latitude de la première station
 * @param {number} lon2 - Longitude de la deuxième station
 * @param {number} lat2 - Latitude de la deuxième station
 * @return {number} - Distance euclidienne entre les deux stations
 */

function euclideanDistance(lon1, lat1, lon2, lat2) {
    const dx = lon1 - lon2;
    const dy = lat1 - lat2;
    return dx * dx + dy * dy;
}

/**
 * Création de la matrice de distance ici (appel via la fonction sortStationsByProximity) 
 * @param {Array} stations - Liste des stations
 * @return {Array} - Matrice de distance entre les stations
 */

function createDistanceMatrix(stations) {
    const distanceMatrix = stations.map(s1 =>
        stations.map(s2 =>
            s1 === s2 ? 0 : euclideanDistance(
                s1.longitude, s1.latitude,
                s2.longitude, s2.latitude
            )
        )
    );
    console.log("Matrice des distances:", distanceMatrix);
    return distanceMatrix;
}

/**
 * Triage des stations à l'aide d'une matrice de distance 
 * Récupérer les deux stations les plus proches puis ajouter la station la plus proche de la dernière station ajoutée
 * @param {Array} stations - Liste des stations
 * @return {Array} - Liste des stations triées par proximité
 * @throws {Error} - Si la liste des stations est vide ou contient moins de deux stations
 */

function sortStationsByProximity(stations) {
    if (stations.length < 2) return stations;

    const distanceMatrix = createDistanceMatrix(stations);
    const visited = new Set();
    const sorted = [];

    // Trouver le premier point (par exemple celui qui a la plus petite latitude)
    let currentIndex = stations.reduce((minIndex, station, index, array) => 
        station.latitude < array[minIndex].latitude ? index : minIndex
    , 0);

    sorted.push(stations[currentIndex]);
    visited.add(currentIndex);

    while (sorted.length < stations.length) {
        let closestIndex = -1;
        let minDist = Infinity;

        // Chercher parmi toutes les stations NON VISITÉES, la plus proche d'UNE QUELCONQUE station déjà dans sorted
        for (let i = 0; i < stations.length; i++) {
            if (visited.has(i)) continue;

            for (let j = 0; j < sorted.length; j++) {
                const sortedIndex = stations.indexOf(sorted[j]);
                const dist = distanceMatrix[sortedIndex][i];
                if (dist < minDist) {
                    minDist = dist;
                    closestIndex = i;
                }
            }
        }

        if (closestIndex !== -1) {
            sorted.push(stations[closestIndex]);
            visited.add(closestIndex);
        }
    }

    return sorted;
}


/**
 * Récupération des données de niveaux de nappe de l'API 
 */

if (!stationsData || !stationsData.stations) {
    console.error("Les données des stations sont invalides ou absentes.");
} else {
    async function fetchStationsData() {

        for (const station of stationsData.stations) {
            const url = `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques?code_bss=${station.codeBss}&date_debut_mesure=${dateDebut}&date_fin_mesure=${dateFin}`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.data.length > 0) {
                    departementStationsInformations.stations.push({
                        commune: station.commune || null,
                        codeBSS: station.codeBss || null,
                        longitude: station.longitude || null,
                        latitude: station.latitude || null,
                        altitude: station.altitude || null,
                        mesuresNappes: data.data.map(mesure => ({
                            date: invertDate(mesure.date_mesure) || null,
                            niveauNappe: mesure.niveau_nappe_eau || null,
                            profondeurNappe: mesure.profondeur_nappe || null
                        }))
                    });
                }

            } catch (error) {
                console.error(`Erreur lors de la récupération des données pour la station ${station.codeBss}:`, error);
            }
        }

        departementStationsInformations.stations = sortStationsByProximity(
            departementStationsInformations.stations.filter(s =>
                s.longitude && s.latitude
            )
        );

        console.log("Stations triées par proximité:", departementStationsInformations.stations);
        document.dispatchEvent(new CustomEvent('stationsDataLoaded'));
    }

    fetchStationsData();
}

baseInfosPannel.innerHTML = `
    <h1> ${stationsData.departement} </h1>
    <h3><span class='bold'>Intervalle de temps:</span> ${invertDate(stationsData.dateDebut)} - ${invertDate(stationsData.dateFin)} </h3>
  `;

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
        const maxDataCount = getMaxDataCount(departementStationsInformations.stations);
        const seriesMinMax = getMinMaxValues(
            departementStationsInformations.stations.map(station =>
                station.mesuresNappes.map(mesure => mesure.niveauNappe)
            )
        );
    
        const shape = new THREE.Shape();
        const angleStep = (Math.PI * 2) / sides;
        const radius = 2;
    
        // Création du polygone
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
    
        // Faire en sorte que la face avec la série[0] soit face à la caméra
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
                font: "https://raw.githubusercontent.com/VonPIP5/DATAVIS-JUNON/refs/heads/Partie-Maël/custom-font-a-Frame/custom-a-frame.fnt",
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

                const height = 0.25;
                const width = sideLength;
                const depth = 0.01;
                const posY = j * height + height / 2;

                if (!dataPoint || dataPoint.niveauNappe === null || isNaN(dataPoint.niveauNappe)) {
                    continue; // on saute les mesures manquantes, donc espace vide
                }

                const value = dataPoint.niveauNappe;
                const [r, g, b] = echelleCouleur(color_begin, color_end, min, max, value);
                const color = `rgb(${r}, ${g}, ${b})`;

                const rectangleGeometry = new THREE.BoxGeometry(width, height, depth);
                const rectangleMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    transparent: true,
                    opacity: 1
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

/**
 * Gestion du champ pour mettre en évidence le nom d'une station
 */

function searchStation() {
    const searchTerm = searchInput.value;

    if (searchTerm) {
        const found = departementStationsInformations.stations.find(station =>
            station.codeBSS == searchTerm || station.commune.toLowerCase() == searchTerm.toLowerCase());

        if (found) {
            const stationCode = found.codeBSS;
            highlightSerieByCodeBSS(stationCode);
            rotatePolygonToFaceCamera(stationCode);
        }
    }
}

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchStation();
    }
});
searchButton.addEventListener('click', () => {
    searchStation();
});
resetButton.addEventListener('click', () => {
    searchInput.value = '';

    if (currentHighlight && currentHighlight.parent) {
        currentHighlight.parent.remove(currentHighlight);
        currentHighlight = null;
    }
    resetLabelHighlight();
});

/**
 * Coloriser en blanc la série de mesures sélectionnée
 * @param {string} codeBSS - Le code BSS de la station à afficher
 */

function highlightSerieByCodeBSS(codeBSS) {
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

function resetLabelHighlight() {
    const allLabels = document.querySelectorAll('[id="codeBSSLabel"]');
    allLabels.forEach(label => {
        const textAttr = label.getAttribute('text');
        label.setAttribute('text', {
            ...textAttr,
            color: '#c6d0d4'
        });
    });
}

/**
 * Faire tourner le polygone pour qu'il fasse face à la caméra
 * @param {string} codeBSS - Le code BSS de la station à afficher
 */

function rotatePolygonToFaceCamera(codeBSS) {
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
 * Récupération des coordonnées des stations du département pour en calculer l'average et les retourner pour permettre la création de la carte centrée
 * @param {Array} stations - Liste des stations
 * @return {Object} - Objet contenant les coordonnées, la latitude et la longitude moyennes
 */

function getCoordsAndAvg(stations) {
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

function generateMap(coords, avgLat, avgLon) {
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
