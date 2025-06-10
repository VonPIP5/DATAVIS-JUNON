/**
 * @file graphs.js
 * Module de gestion des graphiques
 * Récupération, traitement et préparation des données pour la visualisation en 2D sur des graphiques avec D3.js
 */

import { getAllDates, departementStationsInformations, invertDate } from './data.js';

/**
 * @function createNormalizedChart
 * Crée un graphique normalisé des niveaux de nappe pour toutes les stations
 */

export function createNormalizedChart() {
    const stations = departementStationsInformations.stations;

    const panel = document.getElementById("normalizedChartSection");
    panel.innerHTML = "";

    const panelWidth = panel.clientWidth * 1;
    const panelHeight = panel.clientHeight * 1;

    const width = panelWidth;
    const height = panelHeight;
    const marginTop = 60;
    const marginRight = 60;
    const marginBottom = 60;
    const marginLeft = 80;

    const parseDate = d3.timeParse("%d-%m-%Y");
    const formatDate = d3.timeFormat("%d-%m-%Y");

    const allDates = getAllDates(stations);
    const parsedAllDates = allDates.map(parseDate);

    const series = stations.map(station => {
        const values = parsedAllDates.map(date => {
            const formatted = formatDate(date);
            const mesure = station.mesuresNappes.find(m => m.date === formatted);
            return {
                date,
                raw: mesure ? mesure.niveauNappe : null
            };
        }).filter(v => v.raw !== null);

        if (values.length === 0) return null;

        const firstValue = values[0].raw;
        const normalizedValues = values.map(({ date, raw }) => ({
            date,
            value: raw / firstValue
        }));

        return {
            key: station.codeBSS,
            values: normalizedValues
        };
    }).filter(Boolean);

    const x = d3.scaleUtc()
        .domain(d3.extent(parsedAllDates))
        .range([marginLeft, width - marginRight])
        .clamp(true);

    const k = d3.max(series, d => d3.max(d.values, v => v.value) / d3.min(d.values, v => v.value));
    const y = d3.scaleLog()
        .domain([1 / k, k])
        .rangeRound([height - marginBottom, marginTop]);

    const z = d3.scaleOrdinal(d3.schemeCategory10).domain(series.map(d => d.key));
    const bisect = d3.bisector(d => d.date).left;

    const svg = d3.select(panel).append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
        .call(g => g.select(".domain").remove());

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, x => +x.toFixed(6) + "×"))
        .call(g => g.selectAll(".tick line").clone()
            .attr("stroke-opacity", d => d === 1 ? null : 0.2)
            .attr("x2", width - marginLeft - marginRight))
        .call(g => g.select(".domain").remove());

    svg.append("text")
        .attr("x", width - marginRight)
        .attr("y", height - 15)
        .attr("text-anchor", "end")
        .attr("fill", "currentColor")
        .attr("font-size", "16px")
        .text("Temps");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", - marginTop)
        .attr("y", 20)
        .attr("text-anchor", "end")
        .attr("fill", "currentColor")
        .attr("font-size", "16px")
        .text("Niveau de nappe normalisé");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop - 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .text("Évolution normalisée des niveaux de nappe");

    const rule = svg.append("g")
        .append("line")
        .attr("y1", height)
        .attr("y2", 0)
        .attr("stroke", "black");

    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value));

    const serie = svg.append("g")
        .style("font", "bold 10px sans-serif")
        .selectAll("g")
        .data(series)
        .join("g");

    serie.append("path")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke", d => z(d.key))
        .attr("d", d => line(d.values));

    serie.append("text")
        .datum(d => ({ key: d.key, value: d.values[d.values.length - 1] }))
        .attr("fill", d => z(d.key))
        .attr("paint-order", "stroke")
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .attr("x", x.range()[1] + 3)
        .attr("y", d => y(d.value.value))
        .attr("dy", "0.35em")
        .text(d => d.key);

    function update(date) {
        date = d3.utcDay.floor(date);
        rule.attr("transform", `translate(${x(date) + 0.5},0)`);

        serie.attr("transform", ({ values }) => {
            const i = bisect(values, date);
            const d0 = values[i - 1] || values[0];
            const d1 = values[i] || values[values.length - 1];
            const closest = !d1 || !d0 ? d0 || d1 : (Math.abs(date - d0.date) < Math.abs(d1.date - date) ? d0 : d1);
            const ratio = closest && values[0] ? closest.value / values[0].value : 1;
            return `translate(0,${y(1) - y(ratio)})`;
        });
    }

    d3.transition()
        .ease(d3.easeCubicOut)
        .duration(1500)
        .tween("date", () => {
            const i = d3.interpolateDate(x.domain()[0], x.domain()[1]);
            return t => update(i(t));
        });

    svg.on("mousemove touchmove", function (event) {
        const [px] = d3.pointer(event, this);
        const date = x.invert(px);
        update(date);
        event.preventDefault?.();
    });

    return svg.node();
}

export async function createBubbleMapChart(departementRecherche = null) {
    const stations = departementStationsInformations.stations;

    // Récupération des conteneurs spécifiques
    const panel = document.getElementById("bubbleMapChartSection");
    const mapContainer = document.getElementById("mapSection");
    const sliderContainer = document.getElementById("sliderSection");

    // Dimensions basées sur le conteneur
    const width = mapContainer.clientWidth;
    const height = mapContainer.clientHeight;

    if (!panel || !mapContainer || !sliderContainer) {
        throw new Error("Conteneurs de la carte à bulles introuvables");
    }

    // Reset des conteneurs
    mapContainer.innerHTML = '';
    sliderContainer.innerHTML = '';

    // --- Tooltip global ---
    let tooltip = document.getElementById('bubbleMapTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'bubbleMapTooltip';
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }
    // Les styles sont maintenant dans le CSS/SCSS

    // Charger le GeoJSON
    let franceGeoJSON;
    try {
        franceGeoJSON = await d3.json("modules_visu_tube/data_geoJSON/departements-version-simplifiee.geojson");
        if (!franceGeoJSON || !franceGeoJSON.features) throw new Error("GeoJSON mal formé ou vide");
    } catch (e) {
        mapContainer.innerHTML = `<div style="color:red;">Erreur de chargement du fond de carte : ${e.message}</div>`;
        return;
    }

    // Trouver le département à zoomer
    let departementFeature = null;
    if (departementRecherche) {
        departementFeature = franceGeoJSON.features.find(
            f => f.properties.code === departementRecherche || f.properties.nom === departementRecherche
        );
        if (!departementFeature) {
            mapContainer.innerHTML = `<div style="color:red;">Département "${departementRecherche}" introuvable.</div>`;
            return;
        }
    }

    // Projection dynamique centrée et zoomée sur le département
    let projection;
    try {
        projection = d3.geoConicConformal()
            .fitSize([width, height], departementFeature || { type: "FeatureCollection", features: franceGeoJSON.features });
    } catch (e) {
        mapContainer.innerHTML = `<div style="color:red;">Erreur de projection : ${e.message}</div>`;
        return;
    }

    const path = d3.geoPath().projection(projection);

    // Dates disponibles
    const allDates = Array.from(
        new Set(stations.flatMap(station => station.mesuresNappes.map(m => m.date)))
    ).sort((a, b) => {
        const da = a.split("-").reverse().join("-");
        const db = b.split("-").reverse().join("-");
        return new Date(da) - new Date(db);
    });

    if (!allDates.length) {
        mapContainer.innerHTML = `<div style="color:red;">Aucune date de mesure trouvée.</div>`;
        return;
    }

    let currentDateIndex = 0;

    // Préparer les données par station
    const stationData = stations.map(station => {
        const mesures = station.mesuresNappes
            .slice()
            .sort((a, b) => {
                const da = a.date.split("-").reverse().join("-");
                const db = b.date.split("-").reverse().join("-");
                return new Date(da) - new Date(db);
            });
        if (!mesures.length || !station.latitude || !station.longitude) return null;
        const values = mesures.map(m => ({
            date: m.date,
            niveau: m.niveauNappe
        }));
        return {
            code: station.codeBSS,
            nom: station.nom || "",
            commune: station.commune || "",
            lat: parseFloat(station.latitude),
            lon: parseFloat(station.longitude),
            values
        };
    }).filter(Boolean);

    if (!stationData.length) {
        mapContainer.innerHTML = `<div style="color:red;">Aucune station avec coordonnées et mesures exploitables.</div>`;
        return;
    }

    // Préparer un mapping date -> [valeurs de niveau de nappe]
    const niveauxParDate = {};
    allDates.forEach(date => {
        niveauxParDate[date] = stationData
            .map(station => {
                const mesure = station.values.find(m => m.date === date);
                return mesure ? mesure.niveau : null;
            })
            .filter(v => v !== null && !isNaN(v));
    });

    // --- SLIDER ---
    const sliderDiv = d3.select(sliderContainer)
        .attr("id", "sliderSection") // pour la cohérence
        .attr("class", "slider-section"); // pour la cohérence

    const prevBtn = sliderDiv.append("button")
        .text("⏪")
        .attr("aria-label", "Date précédente")
        .on("click", () => {
            if (currentDateIndex > 0) {
                currentDateIndex--;
                updateBubbles(currentDateIndex);
                slider.property("value", currentDateIndex);
                dateLabel.text(allDates[currentDateIndex]);
                updateBtnState();
            }
        });

    const slider = sliderDiv.append("input")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", allDates.length - 1)
        .attr("value", currentDateIndex);

    const dateLabel = sliderDiv.append("span")
        .text(allDates[currentDateIndex]);

    const nextBtn = sliderDiv.append("button")
        .text("⏩")
        .attr("aria-label", "Date suivante")
        .on("click", () => {
            if (currentDateIndex < allDates.length - 1) {
                currentDateIndex++;
                updateBubbles(currentDateIndex);
                slider.property("value", currentDateIndex);
                dateLabel.text(allDates[currentDateIndex]);
                updateBtnState();
            }
        });

    slider.on("input", function () {
        currentDateIndex = +this.value;
        updateBubbles(currentDateIndex);
        dateLabel.text(allDates[currentDateIndex]);
        updateBtnState();
    });

    function updateBtnState() {
        prevBtn.attr("disabled", currentDateIndex === 0 ? true : null);
        nextBtn.attr("disabled", currentDateIndex === allDates.length - 1 ? true : null);
    }
    updateBtnState();

    // Crée un SVG qui prend toute la place de la div, et adapte le viewBox
    const svg = d3.select(mapContainer).append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", [0, 0, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Dessin du fond de carte
    svg.append("g")
        .selectAll("path")
        .data(franceGeoJSON.features)
        .join("path")
        .attr("fill", d => departementFeature && d === departementFeature ? "#ffe082" : "#f0f0f0")
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .attr("d", path);

    // Groupe pour les cercles
    const bubblesGroup = svg.append("g");

    // Titre
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Carte des niveaux de nappe normalisés");

    // Fonction de mise à jour des bulles
    function updateBubbles(dateIndex) {
        const date = allDates[dateIndex];
        const niveaux = niveauxParDate[date];
        let min = d3.min(niveaux);
        let max = d3.max(niveaux);

        if (min === max) {
            min = min - 1;
            max = max + 1;
        }

        const bubbles = stationData.map(station => {
            const mesure = station.values.find(val => val.date === date);
            if (!mesure) return null;
            const niveauNormalise = (mesure.niveau - min) / (max - min);
            return {
                ...station,
                niveau: mesure.niveau,
                normalise: niveauNormalise,
                date: date
            };
        }).filter(Boolean);

        if (!bubbles.length) {
            d3.select(mapContainer).selectAll(".nodata-msg").data([1])
                .join("div")
                .attr("class", "nodata-msg")
                .text("Aucune donnée pour la date sélectionnée.");
        } else {
            d3.select(mapContainer).selectAll(".nodata-msg").remove();
        }

        // Taille des points (min 5px, max 50px de diamètre)
        const minDiam = 10, maxDiam = 100;
        const radiusScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minDiam / 2, maxDiam / 2]);

        const circles = bubblesGroup.selectAll("circle")
            .data(bubbles, d => d.code + '-' + date); // clé unique station+date

        circles.join(
            enter => enter.append("circle")
                .attr("cx", d => {
                    const proj = projection([d.lat, d.lon]);
                    return proj ? proj[0] : -1000;
                })
                .attr("cy", d => {
                    const proj = projection([d.lat, d.lon]);
                    return proj ? proj[1] : -1000;
                })
                .attr("r", 0)
                .attr("fill", "#1976d2")
                .attr("fill-opacity", 0.7)
                .attr("stroke", "#0d47a1")
                .attr("stroke-width", 0.7)
                .style("cursor", "pointer")
                .on("click", function (event, d) {
                    tooltip.style.display = 'block';
                    tooltip.innerHTML = `
                        <div><b>Date :</b> ${d.date}</div>
                        <div><b>Commune :</b> ${d.commune}</div>
                        <div><b>Station :</b> ${d.nom}</div>
                        <div><b>Code BSS :</b> ${d.code}</div>
                        <div><b>Niveau nappe :</b> ${d.niveau.toFixed(2)}</div>
                        `;
                    tooltip.style.left = (event.clientX + 15) + 'px';
                    tooltip.style.top = (event.clientY + 15) + 'px';
                    event.stopPropagation();
                })
                .transition()
                .duration(500)
                .attr("r", d => radiusScale(d.normalise)),
            update => update
                .transition()
                .duration(500)
                .attr("cx", d => {
                    const proj = projection([d.lat, d.lon]);
                    return proj ? proj[0] : -1000;
                })
                .attr("cy", d => {
                    const proj = projection([d.lat, d.lon]);
                    return proj ? proj[1] : -1000;
                })
                .attr("r", d => radiusScale(d.normalise)),
            exit => exit
                .transition()
                .duration(500)
                .attr("r", 0)
                .remove()
        );
    }

    // Gestion du clic en dehors des bulles pour masquer le tooltip
    document.body.addEventListener('click', function () {
        tooltip.style.display = 'none';
    });
    tooltip.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    // Initialisation
    updateBubbles(currentDateIndex);

    return svg.node();
}