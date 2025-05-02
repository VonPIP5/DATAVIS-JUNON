/** 
 * Point d'entrée principal de la visualisation des données Hub'eau
 * Importe et coordonne les différents modules
 */

import { fetchStationsData, departementStationsInformations, invertDate, getCoordsAndAvg, stationsData, dateDebut, dateFin } from './modules_visu_tube/data.js';
import { registerPolygonComponent, highlightSerieByCodeBSS, rotatePolygonToFaceCamera } from './modules_visu_tube/visualisation.js';
import { generateMap } from './modules_visu_tube/map.js';

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('search');
const resetButton = document.getElementById('reset');
const infoPanel = document.getElementById('infoPanel');
const baseInfosPannel = document.getElementById('baseInfosPanel');


// Initialisation de l'interface
baseInfosPannel.innerHTML = `
    <h1>${stationsData.departement}</h1>
    <h3><span class='bold'>Intervalle de temps:</span> ${invertDate(stationsData.dateDebut)} - ${invertDate(stationsData.dateFin)}</h3>
`;

// Enregistrement du composant A-Frame
registerPolygonComponent();

// Récupération des données
if (!stationsData || !stationsData.stations) {
    console.error("Les données des stations sont invalides ou absentes.");
} else {
    fetchStationsData(dateDebut, dateFin).then(() => {
        // Génération de la carte après chargement des données
        const { coords, avgLat, avgLon } = getCoordsAndAvg(departementStationsInformations.stations);
        generateMap(coords, avgLat, avgLon);
    });
}

// Gestion des événements
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchStation();
});
searchButton.addEventListener('click', searchStation);
resetButton.addEventListener('click', () => {
    searchInput.value = '';

    if (currentHighlight && currentHighlight.parent) {
        currentHighlight.parent.remove(currentHighlight);
        currentHighlight = null;
    }
    resetLabelHighlight();
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

// Fonctions globales exportées
// export { highlightSerieByCodeBSS, rotatePolygonToFaceCamera, resetLabelHighlight };
export { infoPanel };