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

                console.log(data.data);

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

    //Set le nombre de côtés en fonction du nombre de séries de données
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

        // Tracage le polygone
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

        /**
        * TODO
        * Affichage des informations de la station associée au rectangle où l'on souhaite cliquer
        */
        AFRAME.registerComponent('click-listener', {
            init: function () {
                this.el.addEventListener('click', () => {
                    const data = this.userData;

                    infoPanel.style.display = 'block';
                    console.log(`Mesure sélectionnée : ${data}`);

                    if (!data) {
                        infoPanel.innerHTML = `<h1>Aucune donnée récupérée.</h1>`
                        console.error("Aucune donnée récupérée.");
                        return;
                    }

                    console.log(`Mesure sélectionnée : ${data}`);

                    infoPanel.innerHTML = `
                <h1> TEST </h1>
                <h2> ${data.commune} </h2>
                <p><span class='bold'>Code BSS:</span> ${data.codeBSS} </p>
                <p><span class='bold'>Altitude:</span> ${data.altitude} </p>
                <p><span class='bold'>Profondeur:</span> ${data.profondeurNappe} </p>
                <hr/>
                <h3>Mesures</h3>
                <p><span class='bold'>Date de la mesure:</span> ${data.date_mesure} </p>
                <p><span class='bold'>Mesure:</span> ${data.niveauNappe} </p>
                <p><span class='bold'>Mesure minimum:</span> ${data.niveauMin} </p>
                <p><span class='bold'>Mesure maximum:</span> ${data.niveauMax} </p>
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

            for (let j = 0; j < dataCount; j++) {
                const value = dataValues[j].niveauNappe;

                //déterminer l'opacité du rectangle de mesure si l'une des mesures en une chaine vide ou NULL
                const opacity = !value ? 0 : 1;

                const grayValue = getGrayColor(value, min, max);
                const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;

                //Set les dimensions des rectangles de mesure
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

                //Placement des rectangles de mesure contre les côtés du polygone
                const progress = 0.5;
                const posX = startX + dirX * progress;
                const posZ = startZ + dirZ * progress;

                //Gestion de la hauteur verticale (en fonction de la hauteur d'une mesure de la série sur le polygone pour qu'il soit au bon niveau)
                const posY = j * height + height / 2;

                rectangle.position.set(posX, posY, posZ);

                //Trouver l'angle du côté du polygone pour y attcher nos rectangles de mesures
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
                };

                //TODO

                rectangle.userData = tabtest;

                // console.log('userData :', rectangle.userData);

                this.el.appendChild(rectangle.el);
                this.el.object3D.add(rectangle);
            }
        }
    }
});
