/**
 * @file graphs.js
 * Module de gestion des graphiques
 * Récupération, traitement et préparation des données pour la visualisation en 2D sur des graphiques avec D3.js
 */

import { getAllDates, departementStationsInformations } from './data.js';

/**
 * @function createMultiLineChart
 * Crée un graphique multi-lignes des niveaux de nappe pour toutes les stations
 */

export function createMultiLineChart() {
    const stations = departementStationsInformations.stations;

    const panel = document.getElementById("multiLineChartSection");
    panel.innerHTML = "";

    const panelWidth = panel.clientWidth * 1;
    const panelHeight = panel.clientHeight * 1;

    const width = panelWidth;
    const height = panelHeight;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 30;
    const marginLeft = 50;

    const allDates = getAllDates(stations);
    const data = stations.map(station => ({
        name: station.codeBSS,
        values: allDates.map(date => {
            const mesure = station.mesuresNappes.find(m => m.date === date);
            return {
                date: new Date(date.split('-').reverse().join('-')),
                niveauNappe: mesure ? mesure.niveauNappe : null
            };
        })
    }));

    const x = d3.scaleTime()
        .domain(d3.extent(allDates, d => new Date(d.split('-').reverse().join('-'))))
        .range([marginLeft, width - marginRight]);

    const y = d3.scaleLinear()
        .domain([
            d3.min(data, d => d3.min(d.values, v => v.niveauNappe)),
            d3.max(data, d => d3.max(d.values, v => v.niveauNappe))
        ])
        .nice()
        .range([height - marginBottom, marginTop]);

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;");

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).ticks(d3.timeDay.every(1)).tickSizeOuter(0))
        .call(g => g.append("text")
            .attr("x", width - marginRight)
            .attr("y", 25)
            .attr("fill", "currentColor")
            .attr("text-anchor", "end")
            .text("Temps"));

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Niveau de nappe (m)"));

    const line = d3.line()
        .defined(d => d.niveauNappe !== null)
        .x(d => x(d.date))
        .y(d => y(d.niveauNappe));

    const path = svg.append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .selectAll("path")
        .data(data)
        .join("path")
        .attr("stroke", "steelblue")
        .attr("d", d => line(d.values))
        .style("mix-blend-mode", "multiply");

    const dot = svg.append("g").attr("display", "none");

    dot.append("circle").attr("r", 4);
    dot.append("text").attr("text-anchor", "middle").attr("y", -10);

    svg.on("pointerenter", pointerentered)
        .on("pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    function pointermoved(event) {
        const [xm, ym] = d3.pointer(event);
        const closest = data.flatMap(d => d.values.map(v => ({ ...v, stationName: d.name })))
            .filter(d => d.niveauNappe !== null)
            .reduce((a, b) => {
                const distA = Math.hypot(x(a.date) - xm, y(a.niveauNappe) - ym);
                const distB = Math.hypot(x(b.date) - xm, y(b.niveauNappe) - ym);
                return distA < distB ? a : b;
            });

        const station = stations.find(s => s.codeBSS === closest.stationName);
        const xPos = x(closest.date);
        const yPos = y(closest.niveauNappe);

        path.style("stroke", d => d.name === closest.stationName ? "steelblue" : "#ddd");
        dot.attr("transform", `translate(${xPos},${yPos})`);
        dot.select("text").text(
            `${station.commune || "Commune inconnue"} (${station.codeBSS})\n${closest.niveauNappe.toFixed(2)} m`
        );
        dot.attr("display", null);
    }

    function pointerentered() {
        path.style("stroke", "#ddd");
        dot.attr("display", null);
    }

    function pointerleft() {
        path.style("stroke", "steelblue");
        dot.attr("display", "none");
    }

    return svg.node();
}


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
    const marginTop = 20;
    const marginRight = 40;
    const marginBottom = 30;
    const marginLeft = 40;

    const parseDate = d3.timeParse("%d-%m-%Y");
    const formatDate = d3.timeFormat("%d-%m-%Y");

    const allDates = getAllDates(stations);
    const parsedAllDates = allDates.map(parseDate);

    // Reformat des données normalisées
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
            const d0 = values[i - 1];
            const d1 = values[i];
            const closest = !d1 ? d0 : (date - d0.date < d1.date - date ? d0 : d1);
            const ratio = closest ? closest.value / values[0].value : 1;
            return `translate(0,${y(1) - y(ratio)})`;
        });
    }

    // Animation d’intro
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