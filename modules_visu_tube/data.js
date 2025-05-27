/**
 * @file data.js
 * Module de gestion des données
 * Récupération, traitement et préparation des données pour la visualisation
 */

import { ordreSelect } from '../visuApiMain.js';

export const departementStationsInformations = {
    stations: []
};

const stationsData = JSON.parse(sessionStorage.getItem('stationsData'));
let dateDebut = stationsData.dateDebut;
let dateFin = stationsData.dateFin;

/**
 * Récupérer le nombre maximum de données pour chaque station
 * @param {Array} stations - Liste des stations
 * @return {number} - Nombre maximum de données pour chaque station
 */

export function getMaxDataCount(stations) {
    return Math.max(...stations.map(station => station.mesuresNappes.length));
}

/**
 * Récupérer les valeurs min et max de chaque série de données
 * @param {Array} data - Liste des séries de données
 * @return {Array} - Liste des objets contenant les valeurs min et max de chaque série
 */

export function getMinMaxValues(data) {
    return data.map(serie => {
        return {
            min: Math.min(...serie),
            max: Math.max(...serie)
        };
    });
}

/**
 * Inverser la date s'il le faut
 * @param {string} date - Date au format YYYY-MM-DD
 * @return {string} - Date au format DD-MM-YYYY
 */

export function invertDate(date) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
}

/**
 * Normaliser les dates pour l'affichage
 * @param {Array} stations - Liste des stations
 * @return {Array} - Liste des dates uniques triées
 */

export function getAllDates(stations) {
    const dateSet = new Set();
    stations.forEach(station => {
        station.mesuresNappes.forEach(m => dateSet.add(m.date));
    });
    return Array.from(dateSet).sort((a, b) => {
        const toSortable = d => d.split('-').reverse().join('-');
        return toSortable(a) > toSortable(b) ? 1 : -1;
    });
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

export function createDistanceMatrix(stations) {
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

export function sortStationsByProximity(stations) {
    if (stations.length < 2) {
        throw new Error("La liste des stations doit contenir au moins deux stations.");
    }

    const stationsCopy = [...stations];
    const distanceMatrix = createDistanceMatrix(stationsCopy);
    const visited = new Set();
    const sorted = [];

    let closestIndex = -1;
    let minDist = Infinity;
    let top = -1;
    let last = -1;

    distanceMatrix.forEach((distStation, key1) => {
        distStation.forEach((dist, key2) => {
            if (dist < minDist && key1 !== key2) {
                top = key1;
                last = key2;
                minDist = dist;
            }
        });
    });

    while (visited.size < stationsCopy.length) {
        let closestIndex = -1;
        let position = 0;
        let minDist = Infinity;
        for (let i = 0; i < stationsCopy.length; i++) {
            if (visited.has(i)) continue;

            const dist1 = distanceMatrix[top][i];
            const dist2 = distanceMatrix[last][i];

            if (dist1 < minDist) {
                minDist = dist1;
                closestIndex = i;
                position = 0;
            }
            if (dist2 < minDist) {
                minDist = dist2;
                closestIndex = i;
                position = 1;
            }
        }

        if (closestIndex !== -1) {
            visited.add(closestIndex);
            if (position === 0) {
                sorted.unshift(stationsCopy[closestIndex]);
                top = closestIndex;
            } else {
                sorted.push(stationsCopy[closestIndex]);
                last = closestIndex;
            }
        }
    }

    return sorted;
}

/**
 * Crée une matrice de distance entre stations basée sur la similarité de niveau de nappe
 * @param {Array} stations - Liste des stations
 */
export function createNappeLevelDistanceMatrix(stations) {
    const allDates = getAllDates(stations);

    // Préparation des vecteurs de mesures pour chaque station, alignés sur les dates
    const vectors = stations.map(station => {
        const niveauMap = new Map();
        station.mesuresNappes.forEach(m => {
            if (m.niveauNappe !== null) {
                niveauMap.set(m.date, parseFloat(m.niveauNappe));
            }
        });

        const vec = allDates.map(date => niveauMap.has(date) ? niveauMap.get(date) : null);
        return interpolateMissingValues(vec);

    });

    const distanceMatrix = vectors.map(v1 =>
        vectors.map(v2 => euclideanDistanceVector(v1, v2))
    );

    console.log("Matrice des distances de niveau de nappe:", distanceMatrix);
    return distanceMatrix;
}

/**
 * Distance euclidienne entre deux vecteurs
 */
function euclideanDistanceVector(a, b) {
    if (a.length !== b.length) return Infinity;
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

/**
 * Remplit un vecteur de valeurs en interpolant les valeurs manquantes (null)
 * @param {Array<number|null>} vec - Vecteur avec trous
 * @return {Array<number>} - Vecteur rempli
 */
function interpolateMissingValues(vec) {
    const filled = [...vec];

    for (let i = 0; i < filled.length; i++) {
        if (filled[i] === null) {
            let before = null;
            let after = null;

            // Chercher valeur avant
            for (let j = i - 1; j >= 0; j--) {
                if (filled[j] !== null) {
                    before = filled[j];
                    break;
                }
            }

            // Chercher valeur après
            for (let j = i + 1; j < filled.length; j++) {
                if (filled[j] !== null) {
                    after = filled[j];
                    break;
                }
            }

            if (before !== null && after !== null) {
                filled[i] = (before + after) / 2;
            } else if (before !== null) {
                filled[i] = before;
            } else if (after !== null) {
                filled[i] = after;
            } else {
                filled[i] = 0; // Si aucune valeur n'est trouvée, on remplit avec 0
            }
        }
    }

    return filled;
}

/**
 * Trie les stations selon la similarité de niveau de nappe
 * @param {Array} stations - Liste des stations avec mesuresNappes
 * @return {Array} - Stations triées par similarité de tendance
 */
export function sortStationsByMesuresNappe(stations) {
    if (stations.length < 2) return stations;

    const stationsCopy = [...stations];
    const nappeLevelMatrix = createNappeLevelDistanceMatrix(stationsCopy);
    const visited = new Set();
    const sorted = [];

    // Trouver les deux stations les plus similaires
    let top = 0, last = 0, minDist = Infinity;
    nappeLevelMatrix.forEach((row, i) => {
        row.forEach((dist, j) => {
            if (i !== j && dist < minDist) {
                minDist = dist;
                top = i;
                last = j;
            }
        });
    });

    visited.add(top);
    visited.add(last);
    sorted.push(stationsCopy[top]);
    sorted.push(stationsCopy[last]);

    while (visited.size < stationsCopy.length) {
        let closest = -1, pos = '', bestDist = Infinity;

        for (let i = 0; i < stationsCopy.length; i++) {
            if (visited.has(i)) continue;

            const dTop = nappeLevelMatrix[top][i];
            const dLast = nappeLevelMatrix[last][i];

            if (dTop < bestDist) {
                closest = i;
                pos = 'top';
                bestDist = dTop;
            }
            if (dLast < bestDist) {
                closest = i;
                pos = 'last';
                bestDist = dLast;
            }
        }

        visited.add(closest);
        if (pos === 'top') {
            sorted.unshift(stationsCopy[closest]);
            top = closest;
        } else {
            sorted.push(stationsCopy[closest]);
            last = closest;
        }
    }

    return sorted;
}

/**
 * Récupération des données de niveaux de nappe de l'API 
 */

export async function fetchStationsData() {

    // Rénitialisation de la liste des stations à chaque appel
    departementStationsInformations.stations = [];

    console.log(stationsData.stations);

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

    const ordreVisu = ordreSelect.value;

    if (ordreVisu && ordreVisu === 'distances') {
        departementStationsInformations.stations = sortStationsByProximity(
            [...departementStationsInformations.stations].filter(s =>
                s.longitude && s.latitude
            )
        );
    } else if (ordreVisu && ordreVisu === 'mesures') {
        departementStationsInformations.stations = sortStationsByMesuresNappe(
            [...departementStationsInformations.stations].filter(s =>
                s.mesuresNappes
            )
        );
        // departementStationsInformations.stations = sortStationsByProximity(
        //     [...departementStationsInformations.stations].filter(s =>
        //         s.longitude && s.latitude
        //     )
        // );
    } else {
        console.error("Ordre de visualisation invalide:", ordreVisu);
    }

    console.log(`Stations triées par proximité de ${ordreVisu}`, departementStationsInformations.stations);
    document.dispatchEvent(new CustomEvent('stationsDataLoaded'));
}

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

export { stationsData, dateDebut, dateFin };