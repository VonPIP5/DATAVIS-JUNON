/** Ressources des API Hub'eau
 * API stations
 * https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?code_departement=&41&date_debut_mesure=2025-03-10&date_fin_mesure=2025-03-20
 * API données stations sur la durée
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

/**
 * Inverser la date s'il le faut 
 */

function invertDate(date) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
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

        document.dispatchEvent(new CustomEvent('stationsDataLoaded'));
    }

    fetchStationsData();
}

/**
 * Déclaration des variables pour les pannels
 */

const baseInfosPannel = document.getElementById('baseInfosPanel')
const infoPanel = document.getElementById('infoPanel');

baseInfosPannel.innerHTML = `
    <h1> ${stationsData.departement} </h1>
    <h3><span class='bold'>Intervalle de temps:</span> ${invertDate(stationsData.dateDebut)} - ${invertDate(stationsData.dateFin)} </h3>
  `;

/**
 * Fonctions utiles pour la création du tube de données
 * getMaxdataCount : récupérer le nombre maximum de données pour chaque station
 * getMinMaxValues : récupérer les valeurs min et max de chaque série de données
 */

function getMaxDataCount(stations) {
    return Math.max(...stations.map(station => station.mesuresNappes.length));
}

function getMinMaxValues(data) {
    return data.map(serie => {
        return {
            min: Math.min(...serie),
            max: Math.max(...serie)
        };
    });
}

/**
 * Calculer la couleur en greyscale pour les mesures
 */

function getGrayColor(value, min, max) {
    const greyscale = ((value - min) / (max - min)) * 255;
    return Math.round(greyscale);
}

AFRAME.registerComponent('polygon', {
    schema: {
        sides: { type: 'int', default: 3, min: 3 },
        depth: { type: 'number', default: 1, min: 1 }
    },

    // Set le nombre de côtés en fonction du nombre de séries de données
    init: function () {
        document.addEventListener('stationsDataLoaded', () => {
            const sides = departementStationsInformations.stations.length;
            this.updateGeometry(sides);
        });
    },

    updateGeometry: function (sides) {
        const maxDataCount = getMaxDataCount(departementStationsInformations.stations);
        const seriesMinMax = getMinMaxValues(
            departementStationsInformations.stations.map(station => station.mesuresNappes.map(mesure => mesure.niveauNappe))
        );

        const shape = new THREE.Shape();
        const angleStep = (Math.PI * 2) / sides;
        const radius = 2;

        if (sides < 3) {
            console.error("Le nombre de côtés doit être au moins 3.");
            return;
        }

        // Tracage du polygone
        for (let i = 0; i < sides; i++) {
            const x = Math.cos(i * angleStep) * radius;
            const y = Math.sin(i * angleStep) * radius;
            if (i === 0) {
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }

        shape.lineTo(Math.cos(0) * radius, Math.sin(0) * radius);

        const extrudeSettings = {
            depth: -maxDataCount / 4,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({
            color: '#3b635c',

            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;

        this.el.setObject3D('mesh', mesh);

        this.createDataRectangles(sides, maxDataCount, seriesMinMax, radius);
    },

    /**
     * Création des rectangles de mesures de données en greyscale
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
                            color: '#ff0000',
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

                    infoPanel.innerHTML = `
                        <h2> ${info.commune} </h2>
                        <p><span class='bold'>Code BSS:</span> ${info.codeBSS} </p>
                        <p><span class='bold'>Altitude:</span> ${info.altitude} </p>
                        <p><span class='bold'>Profondeur:</span> ${info.profondeurNappe} </p>
                        <hr/>
                        <h3 class='bold'>Mesures</h3>
                        <p><span class='bold'>Date de la mesure:</span> ${info.date_mesure} </p>
                        <p><span class='bold'>Niveau de la nappe:</span> ${info.niveauNappe} </p>
                        <p><span class='bold'>Niveau minimum sur l'intervalle:</span> ${info.niveauMin} </p>
                        <p><span class='bold'>Niveau maximum sur l'intervalle:</span> ${info.niveauMax} </p>
                    `;
                });
            }
        });


        for (let i = 0; i < sides; i++) {
            const stationInformations = departementStationsInformations.stations[i];
            const serie = stationInformations?.mesuresNappes;
            if (!serie) continue;

            const dataValues = Object.values(serie);

            const dataCount = dataValues.length;
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
            * Affichage des du nom de la commune à la base de la série de mesures
            */
            const labelDistance = 0.33;
            const labelHeight = 0.1;

            const labelX = startX + dirX * labelDistance;
            const labelZ = startZ + dirZ * labelDistance;
            const labelY = labelHeight;

            const angleRad = Math.atan2(dirZ, dirX);
            const angleDeg = -THREE.MathUtils.radToDeg(angleRad);

            const labelEntity = document.createElement('a-entity');
            labelEntity.setAttribute('position', `${labelX} ${labelY} ${labelZ}`);
            labelEntity.setAttribute('rotation', `-90 ${angleDeg} -90`);
            labelEntity.setAttribute('text', {
                font: "https://raw.githubusercontent.com/VonPIP5/DATAVIS-JUNON/refs/heads/Partie-Maël/custom-font-a-Frame/custom-a-frame.fnt",
                value: stationInformations.codeBSS || 'Ville',
                color: '#FFF',
                align: 'left',
                width: 4,
                baseline: 'bottom',
                wrapCount: 40
            });

            this.el.appendChild(labelEntity);


            for (let j = 0; j < dataCount; j++) {
                const value = dataValues[j].niveauNappe;

                // Déterminer l'opacité du rectangle de mesure si l'une des mesures en une chaine vide ou NULL
                const opacity = !value ? 0 : 1;

                const grayValue = getGrayColor(value, min, max);
                const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;

                // Set les dimensions des rectangles de mesure
                const height = 0.25;
                const width = sideLength;
                const depth = 0.01;

                const rectangleGeometry = new THREE.BoxGeometry(width, height, depth);
                const rectangleMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    transparent: true,
                    opacity: opacity

                });
                const rectangle = new THREE.Mesh(rectangleGeometry, rectangleMaterial);

                // Placement des rectangles de mesure contre les côtés du polygone
                const progress = 0.5;
                const posX = startX + dirX * progress;
                const posZ = startZ + dirZ * progress;

                // Gestion de la hauteur verticale (en fonction de la hauteur d'une mesure de la série sur le polygone pour qu'il soit au bon niveau)
                const posY = j * height + height / 2;

                rectangle.position.set(posX, posY, posZ);

                const sideAngle = Math.atan2(dirZ, dirX);
                rectangle.rotation.y = -sideAngle;

                rectangle.el = document.createElement('a-entity');
                rectangle.el.setObject3D('mesh', rectangle);
                rectangle.el.setAttribute('click-listener', '');

                const tabtest = {
                    infosStation: {
                        commune: stationInformations?.commune || null,
                        codeBSS: stationInformations?.codeBSS || null,
                        altitude: stationInformations?.altitude || null,
                        profondeurNappe: dataValues[j]?.profondeurNappe || null,
                        date_mesure: dataValues[j]?.date || null,
                        niveauNappe: dataValues[j]?.niveauNappe || null,
                        niveauMin: min || null,
                        niveauMax: max || null
                    }
                }

                rectangle.userData = tabtest;

                this.el.appendChild(rectangle.el);
                this.el.object3D.add(rectangle);
            }
        }
    }
});

/**
 * Gestion du champ pour mettre en évidence le nom d'une station
 */

searchImput = document.getElementById('searchInput');
searchButton = document.getElementById('search');
resetButton = document.getElementById('reset');

let communeLabels = [];

function resetLabelColor() {
    communeLabels.forEach(label => {
        label.setAttribute('text', 'color', '#FFF');
    });
}

function searchStation() {
    const searchTerm = searchImput.value.trim().toLowerCase();

    if (searchTerm) {
    resetLabelColor();

        /**
         * Check le tableau "departementStationsInformations.stations"
         * Regarder si le code BSS tapé correspond à un code BSS dans le tableau
         * Regarder si le nom de la commune tapé correspond à un code BSS dans le tableau
         * Si oui, on change la couleur du texte de la station
         * Sinon, rien ne se passe ou alerte "Aucune station trouvée"
         */

        const found = departementStationsInformations.stations.find(station => {
        station.codeBSS == searchTerm || station.commune == searchTerm;
        });

        console.log(found);
    }
}

document.addEventListener('stationsDataLoaded', () => {
    communeLabels = Array.from(document.querySelectorAll('a-entity[text]'));

    searchButton.addEventListener('click', searchStation);
    resetButton.addEventListener('click', () => {
        searchImput.value = '';
        resetLabelColor();
    });

    searchImput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchStation();
        }
    });
});
