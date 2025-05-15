/**
 * @file graphs.js
 * Module de gestion des graphiques
 * Récupération, traitement et préparation des données pour la visualisation en 2D sur des graphiques avec D3.js
 */

import { getAllDates, departementStationsInformations } from './data.js';

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