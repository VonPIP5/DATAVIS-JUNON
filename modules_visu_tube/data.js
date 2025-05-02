/**
 * Module de gestion des données
 * Récupération, traitement et préparation des données pour la visualisation
 */

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

export function sortStationsByProximity(stations) {
    if (stations.length < 2) {
        throw new Error("La liste des stations doit contenir au moins deux stations.");
    }

    const distanceMatrix = createDistanceMatrix(stations);
    const visited = new Set();
    const sorted = [];

    // Choisir la station de départ en tenant compte de la latitude et de la longitude
    let currentIndex = stations.reduce((minIndex, station, index, array) => {
        // Comparer les latitudes, et en cas d'égalité, comparer les longitudes
        if (station.latitude < array[minIndex].latitude) {
            return index;
        }
        if (station.latitude === array[minIndex].latitude && station.longitude < array[minIndex].longitude) {
            return index;
        }
        return minIndex;
    }, 0);

    sorted.push(stations[currentIndex]);
    visited.add(currentIndex);

    // Boucle jusqu'à ce que toutes les stations soient visitées
    while (visited.size < stations.length) {
        let closestIndex = -1;
        let minDist = Infinity;

        // Trouver la station la plus proche de la station actuelle
        for (let i = 0; i < stations.length; i++) {
            if (visited.has(i)) continue;

            const dist = distanceMatrix[currentIndex][i];
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }

        // Ajouter la station la plus proche à la liste triée
        if (closestIndex !== -1) {
            sorted.push(stations[closestIndex]);
            visited.add(closestIndex);
            currentIndex = closestIndex;
        }
    }

    return sorted;
}

/**
 * Récupération des données de niveaux de nappe de l'API 
 */

export async function fetchStationsData() {

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