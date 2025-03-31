let donnees = [
    { data1: 10, data2: 20, data3: 30, data4: 40, data5: 50, data6: '', data7: 70, data8: 80, data9: 90, data10: 100, },
    { data1: 100, data2: 90, data3: 80, data4: 70, data5: 60, data6: 50, data7: 40, data8: 30, data9: 20, data10: 10, },
    { data1: 15, data2: 30 },
    { data1: 18, data2: 70, data3: 25, data4: 48 },
    { data1: 15, data2: 30 },
    { data1: 10, data2: 20, data3: 95, data4: 15, data5: 62 },
];

//TODO
//Récupération des données de l'API
//Si je récupère les données via l'application de Maxime, récupérer toutes les données et les transférer ici.

const infoPanel = document.getElementById('infoPanel');
infoPanel.innerHTML = `
    <h2>Station</h2>
    <h3>Département: </h3>
    <p><strong>Code BSS:</strong> Code BSS</p>
    <p><strong>Altitude:</strong> Altitude</p>
    <p><strong>Profondeur:</strong> profondeur </p>
    <hr/>
    <h3><strong>Intervalle de temps:</strong> 10/03/2025 - 20/03/2025</h3>
    <p><strong>Mesure minimum:</strong> mesure minimum </p>
    <p><strong>Mesure maximum:</strong> mesure maximum </p>
    
  `;

//Trouver la série avec le plus grand nombre de données afin de set la hauteur du polygone
function getMaxDataCount(data) {
    return Math.max(...data.map(serie => Object.keys(serie).length));
}

//Trouver les valeurs minimales et maximales pour chaque série
function getMinMaxValues(data) {
    return data.map(serie => {
        const values = Object.values(serie);
        return {
            min: Math.min(...values),
            max: Math.max(...values)
        };
    });
}

//Calculer la couleur en greyscale pour les mesures
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
        const sides = donnees.length;
        this.updateGeometry(sides);
    },
    updateGeometry: function (sides) {
        const maxDataCount = getMaxDataCount(donnees);
        const seriesMinMax = getMinMaxValues(donnees);

        const shape = new THREE.Shape();
        const angleStep = (Math.PI * 2) / sides;
        const radius = 2;

        for (let i = 0; i < sides; i++) {
            const x = Math.cos(i * angleStep) * radius;
            const y = Math.sin(i * angleStep) * radius;
            if (i === 0) {
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }
        shape.closePath();

        const extrudeSettings = {
            depth: -maxDataCount / 4,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({
            color: 'red',
            side: THREE.DoubleSide,

        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;

        this.el.setObject3D('mesh', mesh);

        this.createDataRectangles(sides, maxDataCount, seriesMinMax, radius);
    },

    //Création des rectangles de mesures de données en greyscale
    createDataRectangles: function (sides, maxDataCount, seriesMinMax, radius) {
        const angleStep = (Math.PI * 2) / sides;
        const sideLength = 2 * radius * Math.sin(Math.PI / sides);

        for (let i = 0; i < sides; i++) {
            const serie = donnees[i];
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
                const value = dataValues[j];

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

                this.el.object3D.add(rectangle);
            }
        }
    }
});

//TODO
// faire un on click sur les rectangles
// update le panel avec les informations de la station (nom de la station, code BSE, données minimum et maximum récupérées)

//TODO
// faire un bouton qui permet la visualisation en 2.5D avec D3 js (sur une autre page surement)

// material.opacity = 0.5; 