// ______________  Déclaration des variables ________________
const joursMesures = 15;
let url
let titre = document.querySelector("#titre");
let parametre = document.querySelector("#parametre");
let question = document.querySelector("#question");
let afficher = document.querySelector("#afficher");
let infoSup = document.querySelector("#infoSup");
let boutonCodeBSS = document.querySelector("#boutonCodeBSS");
let forYou = document.querySelector("#forYou");
let espaceGraphique = document.querySelector("#espaceGraphique");
let row1Col1 = document.querySelector("#row1Col1");
let boutonPeriodeSpecifique = document.querySelector("#boutonPeriodeSpecifique");

let listeCPiezometriques = "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques"
let listeCPiezometriquesTR = "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques_tr"
let listeStations = "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations"

let temps = document.querySelector(".h2");
let parametreTemps = document.querySelector("#referenceTemporel");
let selectTemps = document.querySelector("#selectTemps");
let solutionTemporel2 = document.querySelector("#solutionTemporel2")
let choisirTempsManuel = document.querySelector("#choisirTempsManuel")
let choisirTempsStart = document.querySelector("#choisirTempsStart")
let choisirTempsFinish = document.querySelector("#choisirTempsFinish")
let codeBssSelectioner = document.querySelector("#codeBssSelectioner")

afficher.innerHTML = ""

// ------------------------- Bouton pour la visualisation 3D en colonne/tube -------------------------

function ajouterBoutonVue3D() {
    let buttonVisu = document.getElementById('3dVisu');

    const boutonExistant = document.getElementById("boutonVue3D");
    if (boutonExistant) {
        boutonExistant.remove();
    }

    const boutonVue3D = document.createElement("button");
    boutonVue3D.id = "boutonVue3D";

    console.log(choisirTempsStart.value, choisirTempsFinish.value || 'aucune information');

    let url = '';
    let dateDebut = choisirTempsStart.value;
    let dateFin = choisirTempsFinish.value;

    if (!dateDebut && !dateFin) {
        let today = new Date();
        let XdaysAgo = new Date();
        XdaysAgo.setDate(today.getDate() - joursMesures);

        dateDebut = XdaysAgo.toISOString().split('T')[0];
        dateFin = today.toISOString().split('T')[0];

        boutonVue3D.textContent = `Vue 3D des ${joursMesures} derniers jours`;
    } else {
        dateDebut = invertDate(dateDebut);
        dateFin = invertDate(dateFin);
        boutonVue3D.textContent = "Vue 3D sur la période de temps";
    }

    url = `${listeStations}?code_departement=${selectDepartement.value}&date_debut_mesure=${dateDebut}&date_fin_mesure=${dateFin}`;

    console.log("URL API utilisée :", url);

    buttonVisu.appendChild(boutonVue3D);

    boutonVue3D.addEventListener("click", async () => {
        try {
            console.log(dateDebut, dateFin);


            const response = await fetch(url);
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                console.warn("Aucune donnée trouvée.");
                return;
            }

            const departementStationsInformations = {
                stations: data.data.map(station => ({
                    commune: station.nom_commune,
                    codeBss: station.code_bss,
                    altitude: station.altitude_station
                })),
                departement: data.data[0].nom_departement,
                departementCode: selectDepartement.value,
                dateDebut,
                dateFin,
            };

            sessionStorage.setItem("stationsData", JSON.stringify(departementStationsInformations));
            console.log(departementStationsInformations);
            window.location.href = "visu.html";

        } catch (error) {
            console.error("Erreur lors de la récupération des données des stations :", error);
        }
    });
}

selectDepartement.addEventListener("change", () => {
    if (selectDepartement.value !== "choisirDepartement") {
        ajouterBoutonVue3D();
    }
});

boutonPeriodeSpecifique.addEventListener("click", () => {
    if (selectDepartement.value !== "choisirDepartement") {
        if (choisirTempsStart.value && choisirTempsFinish.value) {
            ajouterBoutonVue3D();
        } else {
            choisirTempsStart.value = "";
            choisirTempsFinish.value = "";
            ajouterBoutonVue3D();
        }
    }
});

// ________________________       MAPS        _______________________________
window.open3DView = function (codeBss) {
    // Trouver le marker correspondant
    let targetMarker;
    map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.info && layer.info.code_bss === codeBss) {
            targetMarker = layer;
        }
    });

    if (!targetMarker || !targetMarker.info) {
        console.error("Marker non trouvé");
        return;
    }

    // Préparer les données
    const stationData = targetMarker.info;
    let waterLevels = [];
    let lastValue = null;

    // Récupérer les données du graphique (WIP)
    try {
        const chartId = 'myChartNiveau' + codeBss;
        const chart = Chart.getChart(chartId);

        if (chart && chart.data && chart.data.datasets && chart.data.datasets[0].data) {
            waterLevels = chart.data.datasets[0].data
                .map(point => typeof point === 'object' ? point.value : point)
                .filter(val => val !== undefined && val !== null);

            if (waterLevels.length > 0) {
                lastValue = waterLevels[waterLevels.length - 1];
            }
        }
    } catch (e) {
        console.error("Erreur lecture graphique:", e);
    }

    // sauvegarder dans localStorage
    const visualizationData = {
        values: waterLevels,
        maxValue: Math.max(...waterLevels),
        minValue: Math.min(...waterLevels),
        stationInfo: {
            codeBss: stationData.code_bss,
            commune: stationData.nom_commune,
            departement: stationData.nom_departement,
            altitude: stationData.altitude_station,
            profondeur: stationData.profondeur_investigation
        },
        lastMeasurement: lastValue,
    };

    console.log("Données à sauvegarder:", visualizationData);

    // Sauvegarde et redirection
    try {
        sessionStorage.removeItem('waterData');
        sessionStorage.setItem('waterData', JSON.stringify(visualizationData));
        console.log("sessionStorage après sauvegarde:", sessionStorage.getItem('waterData'));

        // Ouvrir dans un nouvel onglet
        const newWindow = window.open('http://127.0.0.1:5500/versiontest.html', '_blank');

        // Vérifier que la fenêtre s'est ouverte
        if (!newWindow) {
            alert("Veuillez autoriser les popups pour cette fonctionnalité");
        }
    } catch (e) {
        console.error("Erreur sauvegarde sessionStorage:", e);
        alert("Erreur lors de l'ouverture de la visualisation 3D");
    }
};

let latitude
let longitude

let map = L.map('map').setView([47.590173, 1.336672], 10);

let pointGPS = 0
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var defaultIcon = L.icon({
    iconUrl: 'leaflet/images/marker-icon.png',
    iconSize: [25, 42],
    iconAnchor: [12, 42],
    popupAnchor: [0, -40]
});

var clickedIcon = L.icon({
    iconUrl: 'leaflet/images/marker-icon-rouge.png',
    iconSize: [25, 42],
    iconAnchor: [12, 42],
    popupAnchor: [0, -40]
});

var IconInfo = L.icon({
    iconUrl: 'leaflet/images/marker-icon-violet.png',
    iconSize: [25, 42],
    iconAnchor: [12, 42],
    popupAnchor: [0, -40]
});


var legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'legend');
    div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-2x.png"<span> Station SANS info</span><br>';
    div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-rouge.png"><span> Station cliquée</span><br>';
    div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-violet.png"><span> Station AVEC info</span><br>';
    return div;
};

legend.addTo(map);

// ____________________  RECUPERER LES CODES BSS ____________________
let URLDeps = []
let codeDeps = [18, 28, 36, 37, 41, 45]
let tableauCodeBSS = {
    Cher: [],
    EureEtLoir: [],
    Indre: [],
    IndreEtLoire: [],
    LoirEtCher: [],
    Loiret: []
};

codeDeps.forEach(unDEP => {
    URLDeps.push(`${listeStations}?code_departement=${unDEP}`)
})

URLDeps.forEach(urlUnDep => {
    fetch(urlUnDep)
        .then(response => {
            return response.json();
        })
        .then(data => {
            let valeur = []
            data.data.forEach(infos => {
                valeur.push(infos.code_bss)
            });

            if (data.count == 47) {
                tableauCodeBSS.Cher.push(valeur)
            }
            if (data.count == 79) {
                tableauCodeBSS.EureEtLoir.push(valeur)
            }
            if (data.count == 43) {
                tableauCodeBSS.Indre.push(valeur)
            }
            if (data.count == 44) {
                tableauCodeBSS.IndreEtLoire.push(valeur)
            }
            if (data.count == 61) {
                tableauCodeBSS.LoirEtCher.push(valeur)
            }
            if (data.count == 104) {
                tableauCodeBSS.Loiret.push(valeur)
            }
        })
        .catch(error => {
            console.log("ERREUR DE FOU :" + error)
        });
})

// console.log(tableauCodeBSS)

// _____________________ Fonction période de temps ENTRE une période données et maintenant _______________________
let dateActuelleBonFormat
let dateDeDebutBonFormat

function calculeTemps() {
    let dateActuelle = new Date()
    let dateDeDebut = new Date(dateActuelle)

    switch (selectTemps.value) {
        case '1Semaine':
            dateDeDebut.setDate(dateDeDebut.getDate() - 7);
            dateActuelleBonFormat = formatDate(dateActuelle);
            dateDeDebutBonFormat = formatDate(dateDeDebut);
            erreur.innerHTML = ""

            // console.log("Maintenant : " + dateActuelleBonFormat);
            // console.log("Il y a 1 semaine : " + dateDeDebutBonFormat);
            break;

        case '1Mois':
            dateDeDebut.setMonth(dateDeDebut.getMonth() - 1);
            dateActuelleBonFormat = formatDate(dateActuelle);
            dateDeDebutBonFormat = formatDate(dateDeDebut);
            erreur.innerHTML = ""

            // console.log("Maintenant : " + dateActuelleBonFormat);
            // console.log("Il y a 1 mois : " + dateDeDebutBonFormat);
            break;

        case '3Mois':
            dateDeDebut.setMonth(dateDeDebut.getMonth() - 3);
            dateActuelleBonFormat = formatDate(dateActuelle);
            dateDeDebutBonFormat = formatDate(dateDeDebut);
            erreur.innerHTML = ""

            // console.log("Maintenant : " + dateActuelleBonFormat);
            // console.log("Il y a 3 mois : " + dateDeDebutBonFormat);
            break;

        case '6Mois':
            dateDeDebut.setMonth(dateDeDebut.getMonth() - 6);
            dateActuelleBonFormat = formatDate(dateActuelle);
            dateDeDebutBonFormat = formatDate(dateDeDebut);
            erreur.innerHTML = ""

            // console.log("Maintenant : " + dateActuelleBonFormat);
            // console.log("Il y a 6 mois : " + dateDeDebutBonFormat);
            break;

        default:
            dateActuelleBonFormat = ""
            dateDeDebutBonFormat = ""
    }
}


// _______________ Fonction qui inverse le format de la date :   DD-MM-YYYY ou YYYY-MM-DD _______________

function inverseFormatDate(date) {
    let [year, month, day] = date.split("-")
    return `${day}-${month}-${year}`;
}

function invertDate(date) {
    const [day, month, year] = date.split('-');
    return `${year}-${month}-${day}`;
}

// ________________ Fonction qui affiche une map à l'empassement demander ________________ 
function affichageMap(longMaps, latMaps) {
    pointGPS = 0

    map.remove();
    latitude = latMaps
    longitude = longMaps
    map = L.map('map').setView([latitude, longitude], 9);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-2x.png"<span> Station SANS info</span><br>';
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-rouge.png"><span> Station cliquée</span><br>';
        div.innerHTML += '<img class="imgLegendeMap" src="leaflet/images/marker-icon-violet.png"><span> Station AVEC info</span><br>';
        return div;
    };

    legend.addTo(map);
}
// _________________________________ Code pour le Slider _________________________________
let startDateDiv = document.getElementById("startDate");
let endDateDiv = document.getElementById("endDate");
let slider = document.getElementById("slider");
let boutonSlider = document.querySelector("#boutonSlider");

let dateAujourdhui = new Date();
let dateIlYA1Mois = new Date(dateAujourdhui)
dateIlYA1Mois.setMonth(dateIlYA1Mois.getMonth() - 1);

let dateLaPlusRecente = dateAujourdhui.getTime();
let dateLaPlusAncienne = dateIlYA1Mois.getTime();

function createSlider() {
    noUiSlider.create(slider, {
        start: [dateLaPlusAncienne, dateLaPlusRecente],
        connect: true,
        range: {
            'min': dateLaPlusAncienne,
            'max': dateLaPlusRecente
        },
        step: 24 * 60 * 60 * 1000,
        format: {
            to: value => {
                const date = new Date(value);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${day}-${month}-${year}`;
            },
            from: value => {
                return value;
            }
        }
    });

    slider.noUiSlider.on('update', (values, handle) => {
        if (handle === 0) {
            startDateDiv.textContent = `Date de début : ${values[0]}`;
        } else {
            endDateDiv.textContent = `Date de fin : ${values[1]}`;
        }
    });

    const values = slider.noUiSlider.get();
    startDateDiv.textContent = `Date de début : ${values[0]}`;
    endDateDiv.textContent = `Date de fin : ${values[1]}`;
}

function sliderPageLoad() {
    if (slider.noUiSlider) {
        slider.noUiSlider.destroy();
    }
    createSlider();
}

sliderPageLoad();

function actualiseValeurSlider(dateTouteStationPlusAncienne, dateTouteStationPlusRecente) {
    let Ancienne = new Date(dateTouteStationPlusAncienne);
    let Recente = new Date(dateTouteStationPlusRecente);
    dateLaPlusAncienne = Ancienne.getTime();
    dateLaPlusRecente = Recente.getTime();

    sliderPageLoad(dateLaPlusAncienne, dateLaPlusRecente);
}

function sliderMAJ(infos, dateSliderDebut, dateSliderFin, tousLesMarkers) {
    let urlSlider = `${listeCPiezometriques}?code_bss=${infos.code_bss}&date_debut_mesure=${dateSliderDebut}&date_fin_mesure=${dateSliderFin}`
    let urlSliderTR = `${listeCPiezometriquesTR}?code_bss=${infos.code_bss}&date_debut_mesure=${dateSliderDebut}&date_fin_mesure=${dateSliderFin}`
    let dataPoints = [];

    afficheResultatComplet(infos, urlSlider, dataPoints, urlSliderTR, tousLesMarkers)
}


// _________________   Permet de calculer le point centrale des stations ______________________ 
function calculCentre(x, y) {
    gauche = x[0]
    droite = x[0]
    haut = y[0]
    bas = y[0]

    x.forEach(longitude => {
        if (longitude < gauche) {
            gauche = longitude
        }
        if (longitude > droite) {
            droite = longitude
        }
    })
    y.forEach(latitude => {
        if (latitude < bas) {
            bas = latitude
        }
        if (latitude > haut) {
            haut = latitude
        }
    })

    let longMaps = (gauche + droite) / 2
    let latMaps = (bas + haut) / 2
    affichageMap(longMaps, latMaps)
}
// ___________________________________________________________________________________________

function chercheStations(url) {
    return new Promise((resolve, reject) => {
        // console.log(url)
        // console.log(selectTemps.value)
        // console.log(selectDepartement.value)
        fetch(url)
            .then(response => {
                return response.json();
            })
            .then(data => {
                let x = []
                let y = []
                data.data.forEach(infos => {
                    x.push(infos.x)
                    y.push(infos.y)

                })
                calculCentre(x, y)
                let url1StationLCP
                let url1StationLCPTR
                let dateTouteStationPlusAncienne = formattedDate
                let dateTouteStationPlusRecente = ""

                let nbrResultTrouve = document.createElement("h4")
                nbrResultTrouve.innerHTML = `Nombre de résultat trouvé : ${data.count}`
                nbrResultTrouve.id = "nbrResultTrouve"
                afficher.appendChild(nbrResultTrouve)

                data.data.forEach(infos => {
                    if (infos.date_debut_mesure < dateTouteStationPlusAncienne) {
                        dateTouteStationPlusAncienne = infos.date_debut_mesure
                    }
                    if (infos.date_fin_mesure > dateTouteStationPlusRecente) {
                        dateTouteStationPlusRecente = infos.date_fin_mesure
                    }
                })

                actualiseValeurSlider(dateTouteStationPlusAncienne, dateTouteStationPlusRecente)

                boutonSlider.addEventListener("click", () => {
                    calculCentre(x, y)
                    afficher.innerHTML = "";
                    forYou.innerHTML = "";

                    console.log("Bouton slider cliquer")

                    let nbrResultTrouve = document.createElement("h4")
                    nbrResultTrouve.innerHTML = `Nombre de résultat trouvé : ${data.count}`
                    nbrResultTrouve.id = "nbrResultTrouve"
                    afficher.appendChild(nbrResultTrouve)

                    let splitSliderDebut = startDateDiv.innerHTML.split(" ");
                    let lastElementDebut = splitSliderDebut[splitSliderDebut.length - 1];
                    console.log(lastElementDebut)

                    let splitSliderFin = endDateDiv.innerHTML.split(" ");
                    let lastElementFin = splitSliderFin[splitSliderFin.length - 1];
                    console.log(lastElementFin)

                    let dateSliderDebut = inverseFormatDate(lastElementDebut)
                    let dateSliderFin = inverseFormatDate(lastElementFin)

                    let tousLesMarkers = []

                    data.data.forEach(infos => {
                        sliderMAJ(infos, dateSliderDebut, dateSliderFin, tousLesMarkers)
                    })
                })

                // ___________________________________  _________________________________  _______________________________________
                if (choisirTempsStart.value != "" && choisirTempsFinish.value != "") {
                    // console.log("Quand tu as rentré des valeurs a la main")
                    let tousLesMarkers = []

                    let dateInverseStart = inverseFormatDate(choisirTempsStart.value);
                    let dateInverseFinish = inverseFormatDate(choisirTempsFinish.value);
                    data.data.forEach(infos => {
                        url1StationLCP = `${listeCPiezometriques}?code_bss=${infos.code_bss}&date_debut_mesure=${dateInverseStart}&date_fin_mesure=${dateInverseFinish}`
                        url1StationLCPTR = `${listeCPiezometriquesTR}?code_bss=${infos.code_bss}&date_debut_mesure=${dateInverseStart}&date_fin_mesure=${dateInverseFinish}`
                        let dataPoints = [];
                        // console.log(url1StationLCPTR)

                        afficheResultatComplet(infos, url1StationLCP, dataPoints, url1StationLCPTR, tousLesMarkers)
                    })

                }
                // ___________________________________  _________________________________  _______________________________________

                else if (selectTemps.value != "choisirTemps") {
                    let tousLesMarkers = []

                    data.data.forEach(infos => {
                        url1StationLCP = `${listeCPiezometriques}?code_bss=${infos.code_bss}&date_debut_mesure=${dateDeDebutBonFormat}&date_fin_mesure=${dateActuelleBonFormat}`
                        url1StationLCPTR = `${listeCPiezometriquesTR}?code_bss=${infos.code_bss}&date_debut_mesure=${dateDeDebutBonFormat}&date_fin_mesure=${dateActuelleBonFormat}`
                        let dataPoints = [];
                        // console.log(url1StationLCP)


                        afficheResultatComplet(infos, url1StationLCP, dataPoints, url1StationLCPTR, tousLesMarkers)
                    })
                    // console.log("Si le select temps a une valeur")
                }

                else if (selectTemps.value == "choisirTemps") {
                    let tousLesMarkers = []

                    data.data.forEach(infos => {
                        url1StationLCP = `${listeCPiezometriques}?code_bss=${infos.code_bss}`
                        url1StationLCPTR = `${listeCPiezometriquesTR}?code_bss=${infos.code_bss}`
                        afficheResultatSimple(infos)

                        markerCouleurBleu(infos, tousLesMarkers)
                    });

                }
            })

        resolve([
            { dateDeDebutBonFormat: `${dateDeDebutBonFormat}` },
            { dateActuelleBonFormat: `${dateActuelleBonFormat}` }
        ]);
    })
}

// _____ fonction pour les couleurs marqueur quand c'est un affichage simple _____
function markerCouleurBleu(info1erUrl, tousLesMarkers) {
    let marker = L.marker([info1erUrl.y, info1erUrl.x], { icon: defaultIcon, originalIcon: defaultIcon }).addTo(map);

    const popupContent = `
        <b>${info1erUrl.nom_commune}</b>
        <p>${info1erUrl.nom_departement}<br>
        Code BSS: ${info1erUrl.code_bss}</p>
        <button onclick="open3DView('${info1erUrl.code_bss}')" 
                style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
            Visualiser en 3D
        </button>
    `;

    marker.bindPopup(popupContent);
    marker.info = info1erUrl;

    tousLesMarkers.push(marker);
    clickMarkerBleu(tousLesMarkers);

    marker.addEventListener("click", () => {
        afficheForYou(info1erUrl.code_bss);
    });
}

function clickMarkerBleu(tousLesMarkers) {
    // console.log(tousLesMarkers)
    var currentRedMarker = null;

    tousLesMarkers.forEach(function (marker) {
        marker.on('click', function () {
            if (currentRedMarker && currentRedMarker !== marker) {
                currentRedMarker.setIcon(currentRedMarker.options.originalIcon);
            }
            if (currentRedMarker === marker) {
                marker.setIcon(marker.options.originalIcon);
                currentRedMarker = null;
            } else {
                marker.setIcon(clickedIcon);
                currentRedMarker = marker;
            }
        });
    });

}
// _______________________________________________________________________________

function markerCouleurViolet(info1erUrl, tousLesMarkers) {
    let marker = L.marker([info1erUrl.y, info1erUrl.x], { icon: IconInfo, originalIcon: IconInfo }).addTo(map);

    const popupContent = `
        <b>${info1erUrl.nom_commune}</b>
        <p>${info1erUrl.nom_departement}<br>
        Code BSS: ${info1erUrl.code_bss}</p>
        <button onclick="open3DView('${info1erUrl.code_bss}')" 
                style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
            Visualiser en 3D
        </button>
    `;

    marker.bindPopup(popupContent);
    marker.info = info1erUrl;

    tousLesMarkers.push(marker);
    markerViolet(tousLesMarkers);

    marker.addEventListener("click", () => {
        afficheForYou(info1erUrl.code_bss);
    });
}

function markerViolet(tousLesMarkers) {
    var currentRedMarker = null;

    tousLesMarkers.forEach(function (marker) {
        marker.on('click', function () {
            if (currentRedMarker && currentRedMarker !== marker) {
                currentRedMarker.setIcon(currentRedMarker.options.originalIcon);
            }
            if (currentRedMarker === marker) {
                marker.setIcon(marker.options.originalIcon);
                currentRedMarker = null;
            } else {
                marker.setIcon(clickedIcon);
                currentRedMarker = marker;
            }
        });
    });
    //     marker.on('click', function() {
    //       if (currentRedMarker && currentRedMarker !== marker) {
    //         currentRedMarker.setIcon(blueIcon);
    //       }
    //       if (currentRedMarker === marker) {
    //         marker.setIcon(blueIcon);
    //         currentRedMarker = null;
    //       } else {
    //         marker.setIcon(redIcon);
    //         currentRedMarker = marker;
    //       }
    //     });
    //   });


    // defaultIcon
    // IconInfo
}

// _______________   Affiche uniquement la liste des stations sans aucune information concernant le temps, les nappes, ... ____________________
function afficheResultatSimple(infos) {
    let affiche1Station = document.createElement("div");
    affiche1Station.classList.add("accordion-item")
    affiche1Station.id = infos.code_bss

    let buttonInfoStation = document.createElement("button");
    buttonInfoStation.classList.add("accordion-button")
    buttonInfoStation.innerHTML = `Nom de la commune : ${infos.nom_commune}  (code BSS : ${infos.code_bss})`
    affiche1Station.appendChild(buttonInfoStation)

    let divAfficheInfo = document.createElement("div");
    divAfficheInfo.classList.add("accordion-content")

    let rowInfoBasique = document.createElement("div");
    rowInfoBasique.classList.add("row")
    rowInfoBasique.classList.add("infoBaseStation")
    divAfficheInfo.appendChild(rowInfoBasique)

    // __________ ici mettre des infos en plus quand tu clique sur le boutton ________________
    let infoComplementaireBouton = document.createElement("p");
    infoComplementaireBouton.classList.add("col-6")
    infoComplementaireBouton.innerHTML = `Information complémentaire :
                                        <li>Code BSS : ${infos.code_bss}</li>
                                        <li>Altitude de la station : ${infos.altitude_station}</li>
                                        <li>Nombre de mesure piezométrique : ${infos.nb_mesures_piezo}</li>
                                        <li>Profondeur d'investigation : ${infos.profondeur_investigation}</li>`
    rowInfoBasique.appendChild(infoComplementaireBouton)

    meteoAPI(infos, rowInfoBasique)

    affiche1Station.appendChild(divAfficheInfo)

    buttonInfoStation.addEventListener('click', () => {
        const content = buttonInfoStation.nextElementSibling;
        buttonInfoStation.classList.toggle('active');
        buttonInfoStation.classList.toggle("miseEnAvant")
        if (buttonInfoStation.classList.contains('active')) {
            content.style.maxHeight = content.scrollHeight + 'px';
        } else {
            content.style.maxHeight = 0;
        }
    });
    afficher.appendChild(affiche1Station)
}
// _______________  _____________________________________ _______________________________________________ ___________________________________  ____________________

// _______________   Affiche TOUTES les informations, les graphiques, nappes, le temps, ...  ____________________
function afficheResultatComplet(infos, url1StationLCP, dataPoints, url1StationLCPTR, tousLesMarkers) {

    let affiche1Station = document.createElement("div");
    affiche1Station.classList.add("accordion-item")
    affiche1Station.id = infos.code_bss
    let info1erUrl = infos

    let buttonInfoStation = document.createElement("button");
    buttonInfoStation.classList.add("accordion-button")
    buttonInfoStation.innerHTML = `<span class="textDuBouton">Nom de la commune : ${infos.nom_commune}  (code BSS : ${infos.code_bss})</span>`
    affiche1Station.appendChild(buttonInfoStation)

    let divAfficheInfo = document.createElement("div");
    divAfficheInfo.classList.add("accordion-content")

    let rowInfoBasique = document.createElement("div");
    rowInfoBasique.classList.add("row")
    rowInfoBasique.classList.add("infoBaseStation")
    divAfficheInfo.appendChild(rowInfoBasique)

    // __________ ici mettre des infos en plus quand tu clique sur le boutton ________________
    let infoComplementaireBouton = document.createElement("p");
    infoComplementaireBouton.classList.add("col-6")
    infoComplementaireBouton.innerHTML = `Information complémentaire :
                                        <li>Code BSS : ${infos.code_bss}</li>
                                        <li>Altitude de la station : ${infos.altitude_station}</li>
                                        <li>Nombre de mesure piezométrique : ${infos.nb_mesures_piezo}</li>
                                        <li>Profondeur d'investigation : ${infos.profondeur_investigation}</li>`
    rowInfoBasique.appendChild(infoComplementaireBouton)

    meteoAPI(infos, rowInfoBasique)
    // ____________________  Calcule la médiane q1 et q3 de toutes les données _____________________

    function fetchData() {
        return fetch(urlLCPComplete)
            .then(response => response.json())
            .then(data => {
                let tabValeurD = []
                data.data.forEach(infos => {
                    tabValeurD.push(infos.niveau_nappe_eau);
                });

                tabValeurD.sort((a, b) => a - b);

                let nbrValTab = tabValeurD.length;
                let medianeFormule2 = Math.floor(nbrValTab / 2);
                let quartile1For = (nbrValTab + 1) / 4;
                let quartile3For = (3 * (nbrValTab + 1)) / 4;

                if (nbrValTab % 2 == 0) {
                    medianeAncien = (tabValeurD[medianeFormule2 - 1] + tabValeurD[medianeFormule2]) / 2;
                } else {
                    medianeAncien = tabValeurD[medianeFormule2];
                }

                if (Number.isInteger(quartile1For)) {
                    q1Ancien = tabValeurD[quartile1For - 1];
                } else {
                    const chiffreInferieur = Math.floor(quartile1For) - 1;
                    const chiffreSuperieur = Math.ceil(quartile1For) - 1;
                    q1Ancien = (tabValeurD[chiffreInferieur] + tabValeurD[chiffreSuperieur]) / 2;
                }

                if (Number.isInteger(quartile3For)) {
                    q3Ancien = tabValeurD[quartile3For - 1];
                } else {
                    const chiffreInferieur = Math.floor(quartile3For) - 1;
                    const chiffreSuperieur = Math.ceil(quartile3For) - 1;
                    q3Ancien = (tabValeurD[chiffreInferieur] + tabValeurD[chiffreSuperieur]) / 2;
                }

                return {
                    medianeAncien,
                    q1Ancien,
                    q3Ancien,
                    // valeurMin,
                    // valeurMax
                };
            })
    }

    // _____________________________________________________________________________________________

    let urlLCPComplete = `${listeCPiezometriques}?code_bss=${infos.code_bss}&date_debut_mesure=${infos.date_debut_mesure}&date_fin_mesure=${infos.date_fin_mesure}`

    let derniereValeurDataPoints

    fetch(url1StationLCP)
        .then(response => {
            return response.json();
        })
        .then(data => {
            let tabJustDate = []

            if (data.count == 0) {
                let resultat0 = document.createElement("p")
                resultat0.classList.add("col-6")
                resultat0.classList.add("offset-3")
                resultat0.classList.add("resultat0")
                resultat0.innerHTML = "Aucuns résultats trouvé sur cet interval de temps."
                divAfficheInfo.appendChild(resultat0)

                markerCouleurBleu(info1erUrl, tousLesMarkers)
            }
            else {


                data.data.forEach(infos => {
                    dataPoints.push({ date: inverseFormatDate(infos.date_mesure), value: infos.niveau_nappe_eau, profondeur: infos.profondeur_nappe })
                    tabJustDate.push(inverseFormatDate(infos.date_mesure))
                })

                markerCouleurViolet(info1erUrl, tousLesMarkers)

                derniereValeurDataPoints = dataPoints[dataPoints.length - 1]

                // ______________ 1 ligne ______________
                let rowChangerValeur = document.createElement("div");
                rowChangerValeur.classList.add("row")
                divAfficheInfo.appendChild(rowChangerValeur)

                let row2GraphNiveauEau = document.createElement("div");
                row2GraphNiveauEau.classList.add("row")
                divAfficheInfo.appendChild(row2GraphNiveauEau)

                // ______________ 1er graph _______________

                let choisirGraph = document.createElement("div");
                choisirGraph.classList.add("col-6")

                let lienGraph1 = document.createElement("a");
                lienGraph1.classList.add("lien")
                lienGraph1.classList.add("active")
                lienGraph1.id = "lienGraph1"
                lienGraph1.innerHTML = "Toutes les données"
                choisirGraph.appendChild(lienGraph1)

                let lienGraph2 = document.createElement("a");
                lienGraph2.classList.add("lien")
                lienGraph2.id = "lienGraph2"
                lienGraph2.innerHTML = "Période selectionner"
                choisirGraph.appendChild(lienGraph2)

                rowChangerValeur.appendChild(choisirGraph)

                let divNiveauEauGraph = document.createElement("div");
                divNiveauEauGraph.classList.add("col-6")
                row2GraphNiveauEau.appendChild(divNiveauEauGraph)

                let canvas1Station = document.createElement("canvas");
                canvas1Station.id = "myChartNiveau" + infos.code_bss
                canvas1Station.classList.add("fondBlanc")
                divNiveauEauGraph.appendChild(canvas1Station)

                // ______________ 2eme graph _______________
                // Pas encore afficher car affiche uniquement si les dates en temps réele sont utile
                // _________________________________________

                // ______________ 2 ligne ______________
                let row3GraphiqueNiveauTR = document.createElement("div")
                row3GraphiqueNiveauTR.classList.add("row")
                row3GraphiqueNiveauTR.classList.add("Row2Bouton")
                divAfficheInfo.appendChild(row3GraphiqueNiveauTR)

                // ______________ 3eme graph _______________
                let divGraphTemperature = document.createElement("div");
                divGraphTemperature.classList.add("col-6")
                row3GraphiqueNiveauTR.appendChild(divGraphTemperature)

                let canvasTemperatureGraph = document.createElement("canvas");
                canvasTemperatureGraph.id = "myChartTemperature" + infos.code_bss
                canvasTemperatureGraph.classList.add("fondBlanc")
                divGraphTemperature.appendChild(canvasTemperatureGraph)

                // ______________ 4eme graph _______________
                let divGraphHumidite = document.createElement("div");
                divGraphHumidite.classList.add("col-6")
                row3GraphiqueNiveauTR.appendChild(divGraphHumidite)

                let canvasHumiditeGraph = document.createElement("canvas");
                canvasHumiditeGraph.id = "myChartHumidite" + infos.code_bss
                canvasHumiditeGraph.classList.add("fondBlanc")
                divGraphHumidite.appendChild(canvasHumiditeGraph)

                fetchData().then(result => {
                    graphNiveauDeau(dataPoints, infos.code_bss, divNiveauEauGraph, buttonInfoStation, infos, result, lienGraph1, lienGraph2)
                    LCPTRinfos(infos, url1StationLCPTR, derniereValeurDataPoints, row2GraphNiveauEau, result, rowChangerValeur)
                });
                graphTemperature(tabJustDate, infos)
                graphHumidité(tabJustDate, infos)

            }
        })

    affiche1Station.appendChild(divAfficheInfo)

    buttonInfoStation.addEventListener("click", () => {
        const content = buttonInfoStation.nextElementSibling;
        buttonInfoStation.classList.toggle("active");
        buttonInfoStation.classList.toggle("miseEnAvant")
        if (buttonInfoStation.classList.contains("active")) {
            content.style.maxHeight = content.scrollHeight + 'px';
        } else {
            content.style.maxHeight = 0;
        }
    });
    afficher.appendChild(affiche1Station)



}
// _______________ _____________________________________ _______________________________________________ ___________________________________ ____________________

function graphTemperature(tabJustDate, infos) {
    const lat = infos.y;
    const lon = infos.x;

    let urlMeteo = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${inverseFormatDate(tabJustDate[0])}&end_date=${inverseFormatDate(tabJustDate[tabJustDate.length - 1])}&hourly=temperature_2m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`

    fetch(urlMeteo)
        .then(response => {
            return response.json();
        })
        .then(data => {
            afficheGraphTemperature(data.hourly, infos.code_bss)
        })
}

function afficheGraphTemperature(hourlyInfo, codeBss) {
    let temps = []
    let temperature = []
    // console.log(hourlyInfo)

    hourlyInfo.time.forEach(info => {
        info = affichePropreDate(info)
        let [annee, mois, reste] = info.split("-")
        let [jour, heureCom] = reste.split(" ")
        let [heure, minute] = heureCom.split(":")
        temps.push(`${jour}-${mois}-${annee} ${heure}h`);

        // temps.push(affichePropreDate(info))
    })

    hourlyInfo.temperature_2m.forEach(info2 => {
        temperature.push(info2)
    })

    const ctx = document.getElementById('myChartTemperature' + codeBss).getContext('2d');

    myChartTemperature = new Chart(ctx, {
        type: 'line',
        data: {
            labels: temps,
            datasets: [{
                label: "Température",
                data: temperature,
                fill: false,
                borderColor: 'rgb(190, 75, 190)',
                tension: 0
            },
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Température sur l'intervale de temps : ${temps[0]}  -  ${temps[[temps.length - 1]]}`
                },
            },
        }
    });
}

function graphHumidité(tabJustDate, infos) {
    const lat = infos.y;
    const lon = infos.x;

    let urlMeteo = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${inverseFormatDate(tabJustDate[0])}&end_date=${inverseFormatDate(tabJustDate[tabJustDate.length - 1])}&hourly=temperature_2m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`;

    fetch(urlMeteo)
        .then(response => {
            return response.json();
        })
        .then(data => {
            afficheGraphHumidité(data.hourly, infos.code_bss)
        })
}

function afficheGraphHumidité(hourlyInfo, codeBss) {
    let temps = []
    let humidite = []
    // console.log(hourlyInfo)

    hourlyInfo.time.forEach(info => {
        info = affichePropreDate(info)
        let [annee, mois, reste] = info.split("-")
        let [jour, heureCom] = reste.split(" ")
        let [heure, minute] = heureCom.split(":")
        temps.push(`${jour}-${mois}-${annee} ${heure}h`);
    })

    hourlyInfo.relative_humidity_2m.forEach(info2 => {
        humidite.push(info2)
    })

    const ctx = document.getElementById('myChartHumidite' + codeBss).getContext('2d');

    myChartHumidite = new Chart(ctx, {
        type: 'line',
        data: {
            labels: temps,
            datasets: [{
                label: "Humidité",
                data: humidite,
                fill: false,
                borderColor: 'rgb(190, 75, 190)',
                tension: 0
            },
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Humidité sur l'intervale de temps : ${temps[0]}  -  ${temps[[temps.length - 1]]}`
                },
            },
        }
    });
}


// _________________________________ API pour la météo ______________________________________________
let today = new Date();
let year = today.getFullYear();
let month = String(today.getMonth() + 1).padStart(2, '0');
let day = String(today.getDate()).padStart(2, '0');
let formattedDate = `${year}-${month}-${day}`;

function meteoAPI(infos, rowInfoBasique) {
    let selectionDateMeteo = document.createElement("div");
    selectionDateMeteo.classList.add("col-2")
    selectionDateMeteo.classList.add("agenda")

    let inputInfo = document.createElement("input")
    inputInfo.type = "date"
    inputInfo.min = infos.date_debut_mesure
    inputInfo.max = infos.date_fin_mesure
    inputInfo.value = formattedDate

    selectionDateMeteo.appendChild(inputInfo)
    rowInfoBasique.appendChild(selectionDateMeteo)

    let paraAPIMeteo = document.createElement("div");
    paraAPIMeteo.classList.add("col-4")
    paraAPIMeteo.id = "APIMeteo" + infos.code_bss

    let tokenMeteo = "a99dfb457cf401960d022d75050d46dd"
    let urlMeteorologiqueDuJour = "http://api.openweathermap.org/data/2.5/weather?q=" + infos.nom_commune + "&appid=" + tokenMeteo + "&units=metric&lang=fr"

    fetch(urlMeteorologiqueDuJour)
        .then(response => {
            return response.json();
        })
        .then(data => {
            // console.log(data)
            paraAPIMeteo.innerHTML =
                `Information météorologique du ${inverseFormatDate(formattedDate)}:
                <li>Humidité moyenne : ${data.main.humidity}%</li>
                <li>Température moyenne : ${data.main.temp} °C</li>`
        })
        .catch(error => {
            console.log(error)
        });

    rowInfoBasique.appendChild(paraAPIMeteo)

    const lat = infos.y;
    const lon = infos.x;

    let verifDateMeteo = new Date(dateActuelleBonFormat)
    verifDateMeteo.setDate(verifDateMeteo.getDate() - 7);
    verifDateMeteo = formatDate(verifDateMeteo)
    // console.log(verifDateMeteo)

    inputInfo.addEventListener("blur", () => {
        let dateMeteoPasser = inputInfo.value
        // console.log(dateMeteoPasser)

        if (verifDateMeteo > dateMeteoPasser) {
            console.log("ok1")
            let urlMeteoPasser = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateMeteoPasser}&end_date=${dateMeteoPasser}&hourly=temperature_2m,relative_humidity_2m`
            let MoyenneTemperature = 0
            let MoyenneHumidite = 0

            fetch(urlMeteoPasser)
                .then(response => response.json())
                .then(data => {
                    data.hourly.temperature_2m.forEach(info => {
                        MoyenneTemperature += info
                    })
                    data.hourly.relative_humidity_2m.forEach(info2 => {
                        MoyenneHumidite += info2
                    })

                    MoyenneTemperature = MoyenneTemperature / data.hourly.temperature_2m.length
                    MoyenneHumidite = MoyenneHumidite / data.hourly.relative_humidity_2m.length
                    console.log(MoyenneTemperature)
                    console.log(MoyenneHumidite)

                    paraAPIMeteo.innerHTML =
                        `Information météorologique du ${inverseFormatDate(dateMeteoPasser)}:
                <li>Humidité : ${MoyenneHumidite.toFixed(2)}%</li>
                <li>Température : ${MoyenneTemperature.toFixed(2)} °C</li>`
                })
        }
        else {
            console.log("ok2")
            let urlMeteoRecente = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lat}&start_date=${dateMeteoPasser}&end_date=${dateMeteoPasser}&hourly=temperature_2m,relative_humidity_2m`;
            let MoyenneTemperature = 0
            let MoyenneHumidite = 0

            fetch(urlMeteoRecente)
                .then(response => response.json())
                .then(data => {
                    data.hourly.temperature_2m.forEach(info => {
                        MoyenneTemperature += info
                    })
                    data.hourly.relative_humidity_2m.forEach(info2 => {
                        MoyenneHumidite += info2
                    })

                    MoyenneTemperature = MoyenneTemperature / data.hourly.temperature_2m.length
                    MoyenneHumidite = MoyenneHumidite / data.hourly.relative_humidity_2m.length
                    console.log(MoyenneTemperature)
                    console.log(MoyenneHumidite)

                    paraAPIMeteo.innerHTML =
                        `Information météorologique du ${inverseFormatDate(dateMeteoPasser)}:
                <li>Humidité : ${MoyenneHumidite.toFixed(2)}%</li>
                <li>Température : ${MoyenneTemperature.toFixed(2)} °C</li>`
                })
        }
    })
}
// __________________________________________________________________________________________________

function LCPTRinfos(infos, url1StationLCPTR, derniereValeurDataPoints, row2GraphNiveauEau, result, rowChangerValeur) {
    let tabDataTR = []

    fetch(url1StationLCPTR)
        .then(response => {
            return response.json();
        })
        .then(data => {
            data.data.forEach(dateMesure => {

                let dateMesureTRComplete = dateMesure.date_mesure
                let [dateMesureTRymd, leReste] = dateMesureTRComplete.split("T")
                // console.log(leReste)
                if (inverseFormatDate(derniereValeurDataPoints.date) < dateMesureTRymd) {
                    tabDataTR.push({ date: dateMesureTRymd, value: dateMesure.niveau_eau_ngf, profondeur: dateMesure.profondeur_nappe, code: dateMesure.code_bss, heure: leReste })
                }
            })
            if (tabDataTR.length != 0) {
                let choisirGraph2 = document.createElement("div");
                choisirGraph2.classList.add("col-6")

                let lien2Graph1 = document.createElement("a");
                lien2Graph1.classList.add("lien")
                lien2Graph1.classList.add("active")
                lien2Graph1.id = "lien2Graph1"
                lien2Graph1.innerHTML = "Toutes les données"
                choisirGraph2.appendChild(lien2Graph1)

                let lien2Graph2 = document.createElement("a");
                lien2Graph2.classList.add("lien")
                lien2Graph2.id = "lien2Graph2"
                lien2Graph2.innerHTML = "Période selectionner"
                choisirGraph2.appendChild(lien2Graph2)
                rowChangerValeur.appendChild(choisirGraph2)


                let div3erGraphique = document.createElement("div");
                div3erGraphique.classList.add("col-6")
                row2GraphNiveauEau.appendChild(div3erGraphique)

                let canvas3Station = document.createElement("canvas");
                canvas3Station.id = "myChartNiveauTR" + infos.code_bss
                canvas3Station.classList.add("fondBlanc")
                div3erGraphique.appendChild(canvas3Station)



                graphNiveauDeauTR(tabDataTR, infos.code_bss, div3erGraphique, result, lien2Graph1, lien2Graph2)
            }
        })

}


function afficheForYou(IDCodeBss) {
    let afficheCliqueStation = document.getElementById(IDCodeBss)
    if (forYou.innerHTML != "") {
        // console.log(forYou.children[0])
        if (forYou.children[0].id != IDCodeBss) {
            // console.log("c'est pas la meme id")
            nbrResultTrouve.insertAdjacentElement('afterend', forYou.children[0])
            forYou.appendChild(afficheCliqueStation)
        }
        else {
            // console.log("c'est la MEME id")
            nbrResultTrouve.insertAdjacentElement('afterend', afficheCliqueStation)

        }
    }
    else {
        forYou.appendChild(afficheCliqueStation)
    }
}

// _______ Fonction qui format la date (qui l'inverse : YYYY-MM-DD --> DD-MM-YYYY) _________

function formatDate(date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function affichePropreDate(dateAfficher) {
    let dateFomater = dateAfficher.replace('T', ' ').replace('Z', ' ')
    return dateFomater;
}

// _____________________ Fonction qui créer un graphique pour le niveau de la nappe l'eau NGF ________________________

function graphNiveauDeau(dataPoints, codeBSS, divNiveauEauGraph, buttonInfoStation, infos, result, lienGraph1, lienGraph2) {
    const labels = [];
    const values = [];

    let tableauCroissant = []

    dataPoints.forEach(point => {
        labels.push(point.date);
        values.push(point.value);
        tableauCroissant.push(point.value);
        tableauCroissant.sort((a, b) => a - b);
    })

    let valeurMediane
    let q1
    let q3

    let n = tableauCroissant.length
    let formuleMediane = Math.floor(n / 2);
    let formule1erQuartile = (n + 1) / 4;
    let formule3emeQuartile = (3 * (n + 1)) / 4;

    if (n % 2 == 0) {
        valeurMediane = (tableauCroissant[formuleMediane - 1] + tableauCroissant[formuleMediane]) / 2
    }
    else {
        valeurMediane = tableauCroissant[formuleMediane]
    }
    if (Number.isInteger(formule1erQuartile)) {
        q1 = tableauCroissant[formule1erQuartile - 1];
    } else {
        const chiffreInferieur = Math.floor(formule1erQuartile) - 1;
        const chiffreSuperieur = Math.ceil(formule1erQuartile) - 1;
        q1 = (tableauCroissant[chiffreInferieur] + tableauCroissant[chiffreSuperieur]) / 2;
    };
    if (Number.isInteger(formule3emeQuartile)) {
        q3 = tableauCroissant[formule3emeQuartile - 1];
    } else {
        const chiffreInferieur = Math.floor(formule3emeQuartile) - 1;
        const chiffreSuperieur = Math.ceil(formule3emeQuartile) - 1;
        q3 = (tableauCroissant[chiffreInferieur] + tableauCroissant[chiffreSuperieur]) / 2;
    };


    var ctx = document.getElementById('myChartNiveau' + codeBSS).getContext('2d');

    var data = {
        labels: labels,
        datasets: [{
            label: "Niveau nappe d'eau",
            data: values,
            fill: false,
            borderColor: 'rgb(190, 75, 190)',
            tension: 0,
        },
        {
            label: "Mediane",
            borderColor: 'rgba(255, 0, 0, 0.7)',
        },
        {
            label: "1er quartile",
            borderColor: 'rgba(0, 255, 0, 0.7)',
        },
        {
            label: "3ème quartile",
            borderColor: 'rgba(0, 0, 255, 0.7)',
        }]
    };

    let valeurMin = tableauCroissant[0]
    let valeurMax = tableauCroissant[tableauCroissant.length - 1]

    let annotations1

    // Si les 2 sont supérieur a q3
    if (valeurMin > q3Ancien && valeurMax > q3Ancien) {
        annotations1 = {
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("les 2 sont supérieur a q3")
    }
    // Si les 2 sont entre médiane et q3 
    else if (valeurMin < q3Ancien && valeurMin > medianeAncien && valeurMax < q3Ancien && valeurMax > medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("les 2 sont entre médiane et q3")
    }
    // Si les 2 sont entre médiane et q1 
    else if (valeurMin > q1Ancien && valeurMin < medianeAncien && valeurMax > q1Ancien && valeurMax < medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("Si les 2 sont entre médiane et q1")
    }
    // Si les 2 sont inférieur a q1
    else if (valeurMin < q1Ancien && valeurMax < q1Ancien) {
        annotations1 = {
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("les 2 sont inférieur a q1")
    }
    // Si min est + que médiane et - que q3     et     max est + que q3
    else if (valeurMin > medianeAncien && valeurMin < q3Ancien && valeurMax > q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        }
        // console.log("min est + que médiane et - que q3     et     max est + que q3")
    }
    // Si min est - que médiane et + que q1     et     max est + que q3
    else if (valeurMin < medianeAncien && valeurMin > q1Ancien && valeurMax > q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("min est - que médiane et + que q1     et     max est + que q3")
    }
    // Si min est - que q1     et     max est + que q3
    else if (valeurMin < q1Ancien && valeurMax > q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("min est - que q1     et     max est + que q3")
    }
    // Si min est - de médiane et + que q1     et     max est - de q3 et + de médiane
    else if (valeurMin < medianeAncien && valeurMin > q1Ancien && valeurMax < q3Ancien && valeurMax > medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        }
        // console.log("min est - de médiane et + que q1     et     max est - de q3 et + de médiane")
    }
    // Si min est - que q1    et     max est - de q3 et + de médiane
    else if (valeurMin < q1Ancien && valeurMax < q3Ancien && valeurMax > medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        }
        // console.log("min est - que q1    et     max est - de q3 et + de médiane")
    }
    // Si min est - que q1       et     max est - de médiane et + de q1
    else if (valeurMin < q1Ancien && valeurMax < medianeAncien && valeurMax > q1Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("min est - que q1       et     max est - de médiane et + de q1")
    }

    var annotations2 = {
        line1: {
            type: 'line',
            yMin: valeurMediane,
            yMax: valeurMediane,
            borderColor: 'rgba(255, 0, 0, 0.7)',
            borderWidth: 2,
        },
        line2: {
            type: 'line',
            yMin: q1,
            yMax: q1,
            borderColor: 'rgba(0, 255, 0, 0.7)',
            borderWidth: 2,
        },
        line3: {
            type: 'line',
            yMin: q3,
            yMax: q3,
            borderColor: 'rgba(0, 0, 255, 0.7)',
            borderWidth: 2,
        }
    };

    var config = {
        type: 'line',
        data: data,
        options: {
            plugins: {
                annotation: {
                    annotations: annotations1
                },
                title: {
                    display: true,
                    text: "Niveau nappe d'eau"
                },
            },
        }
    };

    let myChartNiveau = new Chart(ctx, config);

    function updateChart(nouvelleAnnotation) {
        myChartNiveau.destroy();
        config.options.plugins.annotation.annotations = nouvelleAnnotation;
        myChartNiveau = new Chart(ctx, config);
    }

    lienGraph1.addEventListener('click', function () {
        updateChart(annotations1);
    });

    lienGraph2.addEventListener('click', function () {
        updateChart(annotations2);
    });

    let dateFinDataPoints = dataPoints[dataPoints.length - 1]
    if (dateFinDataPoints.value <= result.q1Ancien) {
        buttonInfoStation.innerHTML += `<div class="defDesCouleurs">Score du niveau d'eau :   <div class="couleurRouge"></div></div> `
    }
    else if (dateFinDataPoints.value <= result.medianeAncien) {
        buttonInfoStation.innerHTML += `<div class="defDesCouleurs">Score du niveau d'eau :   <div class="couleurOrange"></div></div> `
    }
    else if (dateFinDataPoints.value <= result.q3Ancien) {
        buttonInfoStation.innerHTML += `<div class="defDesCouleurs">Score du niveau d'eau :   <div class="couleurJaune"></div></div> `
    }
    else if (dateFinDataPoints.value > result.q3Ancien) {
        buttonInfoStation.innerHTML += `<div class="defDesCouleurs">Score du niveau d'eau :   <div class="couleurVert"></div></div> `
    }
    else {
        buttonInfoStation.innerHTML += "pas assez de donnée pour faire le calcul"
    }

    let lesInfosMQ1Q3 = document.createElement(`div`)
    lesInfosMQ1Q3.classList.add("lesInfosMQ1Q3")

    let infoRow1 = document.createElement(`div`)
    infoRow1.classList.add("col-6")
    lesInfosMQ1Q3.appendChild(infoRow1)

    let infoRow2 = document.createElement(`div`)
    infoRow2.classList.add("col-6")
    lesInfosMQ1Q3.appendChild(infoRow2)

    infoRow1.innerHTML = `<p class="paraMQ">Valeur actuelle :<br>
                        Médiane : ${valeurMediane} <br>
                        Quartile 1: ${q1} <br>
                        Quartile 3 : ${q3}</p>`
    infoRow2.innerHTML = `<p class="paraMQ">Valeur depuis le début :<br>
                        Médiane : ${result.medianeAncien} <br>
                        Quartile 1 : ${result.q1Ancien} <br>
                        Quartile 3 : ${result.q3Ancien}</p>`
    divNiveauEauGraph.appendChild(lesInfosMQ1Q3)

    let score = buttonInfoStation.lastElementChild
    explicationScore(score)
}

function explicationScore(score) {
    var messageScore = document.getElementById('message');

    score.addEventListener('mouseenter', function (event) {
        messageScore.style.display = 'block';
        messageScore.style.left = event.pageX + 'px';
        messageScore.style.top = event.pageY + 'px';
    });

    score.addEventListener('mouseleave', function () {
        messageScore.style.display = 'none';
    });

    score.addEventListener('mousemove', function (event) {
        messageScore.style.left = event.pageX + 'px';
        messageScore.style.top = event.pageY + 'px';
    });
}

// ___________________________________________________________________________
function graphNiveauDeauTR(tabDataTR, codeBss, div3erGraphique, result, lien2Graph1, lien2Graph2) {
    const labels = [];
    const values = [];

    let tableauCroissant = []

    let tabDataTRChrono = tabDataTR.reverse()

    tabDataTRChrono.forEach(point => {
        let [annee, mois, jour] = point.date.split("-")
        let [heure, minute, seconde] = point.heure.split(":")

        labels.push(`${jour}-${mois}-${annee} ${heure}h`);
        values.push(point.value);
        tableauCroissant.push(point.value);
        tableauCroissant.sort((a, b) => a - b);
    })

    let valeurMediane
    let q1
    let q3

    let n = tableauCroissant.length
    let formuleMediane = Math.floor(n / 2);
    let formule1erQuartile = (n + 1) / 4;
    let formule3emeQuartile = (3 * (n + 1)) / 4;

    if (n % 2 == 0) {
        valeurMediane = (tableauCroissant[formuleMediane - 1] + tableauCroissant[formuleMediane]) / 2
    }
    else {
        valeurMediane = tableauCroissant[formuleMediane]
    }

    if (Number.isInteger(formule1erQuartile)) {
        q1 = tableauCroissant[formule1erQuartile - 1];
    } else {
        const chiffreInferieur = Math.floor(formule1erQuartile) - 1;
        const chiffreSuperieur = Math.ceil(formule1erQuartile) - 1;
        q1 = (tableauCroissant[chiffreInferieur] + tableauCroissant[chiffreSuperieur]) / 2;
    };

    if (Number.isInteger(formule3emeQuartile)) {
        q3 = tableauCroissant[formule3emeQuartile - 1];
    } else {
        const chiffreInferieur = Math.floor(formule3emeQuartile) - 1;
        const chiffreSuperieur = Math.ceil(formule3emeQuartile) - 1;
        q3 = (tableauCroissant[chiffreInferieur] + tableauCroissant[chiffreSuperieur]) / 2;
    };

    var ctx = document.getElementById('myChartNiveauTR' + codeBss).getContext('2d');

    var data = {
        labels: labels,
        datasets: [{
            label: "Niveau nappe d'eau",
            data: values,
            fill: false,
            borderColor: 'rgb(190, 75, 190)',
            tension: 0,
        },
        {
            label: "Mediane",
            borderColor: 'rgba(255, 0, 0, 0.7)',
        },
        {
            label: "1er quartile",
            borderColor: 'rgba(0, 255, 0, 0.7)',
        },
        {
            label: "3ème quartile",
            borderColor: 'rgba(0, 0, 255, 0.7)',
        }]
    };

    let valeurMin = tableauCroissant[0]
    let valeurMax = tableauCroissant[tableauCroissant.length - 1]

    let annotations1


    // Si les 2 sont supérieur a q3
    if (valeurMin > result.q3Ancien && valeurMax > result.q3Ancien) {
        annotations1 = {
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("les 2 sont supérieur a q3")
    }
    // Si les 2 sont entre médiane et q3 
    else if (valeurMin < result.q3Ancien && valeurMin > result.medianeAncien && valeurMax < result.q3Ancien && valeurMax > result.medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("les 2 sont entre médiane et q3")
    }
    // Si les 2 sont entre médiane et q1 
    else if (valeurMin > result.q1Ancien && valeurMin < result.medianeAncien && valeurMax > result.q1Ancien && valeurMax < result.medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("Si les 2 sont entre médiane et q1")
    }
    // Si les 2 sont inférieur a q1
    else if (valeurMin < result.q1Ancien && valeurMax < result.q1Ancien) {
        annotations1 = {
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("les 2 sont inférieur a q1")
    }
    // Si min est + que médiane et - que q3     et     max est + que q3
    else if (valeurMin > result.medianeAncien && valeurMin < result.q3Ancien && valeurMax > result.q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        }
        // console.log("min est + que médiane et - que q3     et     max est + que q3")
    }
    // Si min est - que médiane et + que q1     et     max est + que q3
    else if (valeurMin < result.medianeAncien && valeurMin > result.q1Ancien && valeurMax > result.q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("min est - que médiane et + que q1     et     max est + que q3")
    }
    // Si min est - que q1     et     max est + que q3
    else if (valeurMin < result.q1Ancien && valeurMax > result.q3Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
            line3: {
                type: 'line',
                yMin: result.q3Ancien,
                yMax: result.q3Ancien,
                borderColor: 'rgba(0, 0, 255, 0.7)',
                borderWidth: 2,
            }
        };
        // console.log("min est - que q1     et     max est + que q3")
    }
    // Si min est - de médiane et + que q1     et     max est - de q3 et + de médiane
    else if (valeurMin < result.medianeAncien && valeurMin > result.q1Ancien && valeurMax < result.q3Ancien && valeurMax > result.medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        }
        // console.log("min est - de médiane et + que q1     et     max est - de q3 et + de médiane")
    }
    // Si min est - que q1    et     max est - de q3 et + de médiane
    else if (valeurMin < result.q1Ancien && valeurMax < result.q3Ancien && valeurMax > result.medianeAncien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        }
        // console.log("min est - que q1    et     max est - de q3 et + de médiane")
    }
    // Si min est - que q1       et     max est - de médiane et + de q1
    else if (valeurMin < result.q1Ancien && valeurMax < result.medianeAncien && valeurMax > result.q1Ancien) {
        annotations1 = {
            line1: {
                type: 'line',
                yMin: result.medianeAncien,
                yMax: result.medianeAncien,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
            },
            line2: {
                type: 'line',
                yMin: result.q1Ancien,
                yMax: result.q1Ancien,
                borderColor: 'rgba(0, 255, 0, 0.7)',
                borderWidth: 2,
            },
        };
        // console.log("min est - que q1       et     max est - de médiane et + de q1")
    }

    var annotations2 = {
        line1: {
            type: 'line',
            yMin: valeurMediane,
            yMax: valeurMediane,
            borderColor: 'rgba(255, 0, 0, 0.7)',
            borderWidth: 2,
        },
        line2: {
            type: 'line',
            yMin: q1,
            yMax: q1,
            borderColor: 'rgba(0, 255, 0, 0.7)',
            borderWidth: 2,
        },
        line3: {
            type: 'line',
            yMin: q3,
            yMax: q3,
            borderColor: 'rgba(0, 0, 255, 0.7)',
            borderWidth: 2,
        }
    };

    var config = {
        type: 'line',
        data: data,
        options: {
            plugins: {
                annotation: {
                    annotations: annotations1
                },
                title: {
                    display: true,
                    text: "Niveau nappe d'eau en temps réel"
                },
            },
        }
    };

    let myChartNiveauTR = new Chart(ctx, config);

    function updateChart(nouvelleAnnotation) {
        myChartNiveauTR.destroy();
        config.options.plugins.annotation.annotations = nouvelleAnnotation;
        myChartNiveauTR = new Chart(ctx, config);
    }

    lien2Graph1.addEventListener('click', function () {
        updateChart(annotations1);
    });

    lien2Graph2.addEventListener('click', function () {
        updateChart(annotations2);
    });

    let lesInfosMQ1Q3 = document.createElement(`div`)
    lesInfosMQ1Q3.classList.add("lesInfosMQ1Q3")

    let infoRow1 = document.createElement(`div`)
    infoRow1.classList.add("col-6")
    lesInfosMQ1Q3.appendChild(infoRow1)

    let infoRow2 = document.createElement(`div`)
    infoRow2.classList.add("col-6")
    lesInfosMQ1Q3.appendChild(infoRow2)

    infoRow1.innerHTML = `<p class="paraMQ">Valeur actuelle :<br>
                        Médiane : ${valeurMediane} <br>
                        Quartile 1: ${q1} <br>
                        Quartile 3 : ${q3}</p>`
    infoRow2.innerHTML = `<p class="paraMQ">Valeur depuis le début :<br>
                        Médiane : ${result.medianeAncien} <br>
                        Quartile 1 : ${result.q1Ancien} <br>
                        Quartile 3 : ${result.q3Ancien}</p>`
    div3erGraphique.appendChild(lesInfosMQ1Q3)


}


// _____________________ __________________________ _____________________________ ___________________________ ________________________


selectTemps.addEventListener("change", () => {
    calculeTemps()
    afficher.innerHTML = "";
    forYou.innerHTML = ""
    // console.log(selectDepartement.value)
    if (selectDepartement.value == "choisirDepartement") {
        alert("Aucun département n'a été selectionné, la recherche est donc impossible !");
    }
    else {
        chercheStations(url)
    }
})

selectDepartement.addEventListener("change", () => {
    afficher.innerHTML = "";
    forYou.innerHTML = ""
    codeBssSelectioner.value = "";

    url = `${listeStations}?code_departement=${selectDepartement.value}`

    chercheStations(url)
})

boutonCodeBSS.addEventListener("click", () => {
    afficher.innerHTML = "";
    forYou.innerHTML = ""
    url = `${listeStations}?code_departement=${selectDepartement.value}`

    if (selectDepartement.value == "choisirDepartement") {
        alert("Aucun département n'a été selectionné, la recherche est donc impossible !");
    }
    else {
        let selectedIndex = selectDepartement.selectedIndex;
        let selectedOption = selectDepartement.options[selectedIndex];
        let selectedOptionId = selectedOption.id;
        let tablea1DepComplet = tableauCodeBSS[selectedOptionId][0]
        let bssCodeEntrer = `${codeBssSelectioner.value}`

        if (tablea1DepComplet.includes(bssCodeEntrer)) {
            erreur.innerHTML = ""
            url += `&code_bss=${bssCodeEntrer}`
            chercheStations(url)
        }
        else if (bssCodeEntrer == "") {
            erreur.innerHTML = ""
            // console.log(url)
            chercheStations(url)
        }
        else {
            erreur.innerHTML = "Le code BSS ne fait pas partie de ce département !"
        }
    }
})

boutonPeriodeSpecifique.addEventListener("click", () => {
    afficher.innerHTML = "";
    forYou.innerHTML = "";
    url = `${listeStations}?code_departement=${selectDepartement.value}`

    if (selectDepartement.value == "choisirDepartement") {
        alert("Aucun département n'a été selectionné, la recherche est donc impossible !");
    }
    else {
        chercheStations(url)
    }
})