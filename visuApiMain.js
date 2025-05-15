/** 
 * @file visuApiMain.js
 * Point d'entrée principal de la visualisation des données Hub'eau
 * Importe et coordonne les différents modules
 */

import { fetchStationsData, departementStationsInformations, invertDate, getCoordsAndAvg, stationsData, dateDebut, dateFin } from './modules_visu_tube/data.js';
import { registerPolygonComponent, highlightSerieByCodeBSS, rotatePolygonToFaceCamera } from './modules_visu_tube/visualisation.js';
import { generateMap } from './modules_visu_tube/map.js';
// import { createMultiLineChart, createNormalizedChart } from './modules_visu_tube/graphs.js';
import { createNormalizedChart } from './modules_visu_tube/graphs.js';

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('search');
const resetButton = document.getElementById('reset');
const infoPanel = document.getElementById('infoPanel');
const baseInfosPanel = document.getElementById('baseInfosPanel');
const overlay = document.getElementById('overlay');

const graphiquePanel = document.getElementById('graphiquePanel');
const multiLineChartSection = document.getElementById('multiLineChartSection');
const normalizedChartSection = document.getElementById('normalizedChartSection');
const radialStackedChartSection = document.getElementById('radialStackedChartSection');

// Initialisation de l'interface
baseInfosPanel.innerHTML = `
    <h1>${stationsData.departement}</h1>
    <h3>Intervalle de temps: ${invertDate(stationsData.dateDebut)} - ${invertDate(stationsData.dateFin)}</h3>
    <button id='visuGraphique' class='visuGraphique'>Visualisation graphique normalisée</button>
    <hr/>
    <p><span class='bold'>Ordre de visualisation 3D</span></p>
    <select id="ordre" name="ordre" class="select">
		<option value="distances"> Distances entre stations</option>
		<option value="mesures"> Mesures des nappes </option>
	</select>
`;

const ordreSelect = document.getElementById('ordre');

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

document.getElementById('visuGraphique').addEventListener('click', function () {
    overlay.classList.toggle('active');
    graphiquePanel.classList.toggle('active');
    
    // const multiLineChart = createMultiLineChart();
    // multiLineChartSection.innerHTML = '';
    // multiLineChartSection.appendChild(multiLineChart);
    
    const normalizedChart = createNormalizedChart();
    normalizedChartSection.innerHTML = '';
    normalizedChartSection.appendChild(normalizedChart);
    
});

overlay.addEventListener('click', function () {
    overlay.classList.toggle('active');
    graphiquePanel.classList.toggle('active');
});

ordreSelect.addEventListener('change', function () {
    fetchStationsData(dateDebut, dateFin)
});

// Variables globales exportées
export { infoPanel, graphiquePanel, ordreSelect };