// Deal with empty value (In those provided csv files, '-' & '' are used to represent empty value)
const parseNA = string => ((string === '-' || string === '') ? undefined : string);

// Convert from 民國年 string format to date object
const parseDate = string => {
    const date = d3.timeParse('%Y/%m/%d')(string);
    return new Date(date.getFullYear() + 1911, date.getMonth(), date.getDate());
};

// Format of 行業別: <main>(<sub>) or <a_letter><main>-<four_digits><sub>
// Get main category of 行業別 
const getMainCategory = string => {
    if (string.indexOf('(') === -1) {
        return string.split('-')[0].slice(1);
    } else {
        return string.split('(')[0];
    }
};
// Get sub category of 行業別
const getSubCategory = string => {
    if (string.indexOf('(') === -1) {
        return string.split('-')[1];
    } else {
        return string.split('(')[1].split(')')[0];
    }
};

// Parse 災害類型 (Format of 災害類型: <type>、<type>...)
const parseDisasterType = string => {
    return string.split('、');
};

// format transform & column selection & add
function type(d) {
    const date = parseDate(d.發生日期);
    return {
        main_category: getMainCategory(d.行業別),
        sub_category: getSubCategory(d.行業別),
        date: date,
        year: date.getFullYear(),
        people_amount: +d.罹災人數,
        company: parseNA(d.事業單位),
        disaster_type: parseDisasterType(d.災害類型),
        agency: parseNA(d.勞動檢查機構),
        boss: parseNA(d.業主),
    };
}

// Data selection
function filterData(data, startYear, endYear) {
    return data.filter(
        d => {
            return (
                d.year >= startYear && d.year <= endYear &&
                d.people_amount > 0 &&
                d.main_category &&
                d.disaster_type.length > 0
            );
        }
    );
}

// Prepare people amount for each main category bar chart data
function preparePeopleMainCategoryBarChartData(data) {
    const dataMap = d3.rollup(
        data,
        v => d3.sum(v, leaf => leaf.people_amount),
        d => d.main_category,
    );
    return Array.from(dataMap, d => ({ main_category: d[0], people_amount: d[1] }));
}

// Prepare people amount for each disaster type bar chart data 
// If there are more than one disaster type, both will be counted.
function preparePeopleDisasterTypeBarChartData(data) {
    // If there are more than one disaster type, copy the row and create new row for second, third ... disaster type.
    var extended = [];
    data.forEach(element => {
        for (i = 1; i < element.disaster_type.length; i++) {
            const copyElement = new Object(element);
            copyElement.disaster_type = [copyElement.disaster_type[i]];
            extended.push(copyElement);
        }
    })

    data = data.concat(extended);
    const dataMap = d3.rollup(
        data,
        v => d3.sum(v, leaf => leaf.people_amount),
        d => d.disaster_type[0],
    );
    return Array.from(dataMap, d => ({ disaster_type: d[0], people_amount: d[1] }));
}


// Setup HTML for people vs main cateogry bar chart canvas
function setupPeopleMainCategoryCanvas(barChartData, startYear, endYear) {
    // clear bar-chart-container space
    d3.select('.bar-chart-container').selectAll('svg').remove();

    const svg_width = 500;
    const svg_height = 500;
    const chart_margin = { top: 80, right: 20, bottom: 40, left: 180 };
    const chart_width = svg_width - chart_margin.left - chart_margin.right;
    const chart_height = svg_height - chart_margin.top - chart_margin.bottom;

    const this_svg = d3.select('.bar-chart-container').append('svg')
        .attr("width", svg_width).attr("height", svg_height)
        .append("g")
        .attr('transform', `translate(${chart_margin.left}, ${chart_margin.top})`);

    // scale
    // V1.d3.extent find the max & min in people_amount
    const xExtent = d3.extent(barChartData, d => d.people_amount);
    const xScale_v1 = d3.scaleLinear().domain(xExtent).range([0, chart_width]);
    // V2.0 ~ max
    const xMax = d3.max(barChartData, d => d.people_amount);
    const xScale_v2 = d3.scaleLinear().domain([0, xMax]).range([0, chart_width]);
    // V3.Short writing for v2
    const xScale_v3 = d3.scaleLinear([0, xMax], [0, chart_width]);
    // 垂直空間的分配 - 平均分配給各種行業別
    const yScale = d3.scaleBand().domain(barChartData.map(d => d.main_category)).range([0, chart_height]).padding(0.25);


    // Draw bars
    const bars = this_svg.selectAll('.bar')
        .data(barChartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.main_category))
        .attr('width', d => xScale_v3(d.people_amount))
        .attr('height', yScale.bandwidth())
        .attr('fill', 'steelblue');

    // Draw header
    const header = this_svg.append('g').attr('class', 'bar-header')
        .attr('transform', `translate(0, ${-chart_margin.top/2})`)
        .append('text');
    header.append('tspan').text('各行業罹災人數');
    if (startYear === endYear) {
        header.append('tspan').text(`年份: ${startYear}`)
            .attr('x', 0).attr('y', 20).style('font-size', '0.8em').style('fill', 'gray');
    } else {
        header.append('tspan').text(`年份: ${startYear}~${endYear}`)
            .attr('x', 0).attr('y', 20).style('font-size', '0.8em').style('fill', 'gray');
    }

    // Draw axis
    const xAxis = d3.axisTop(xScale_v3).tickSizeInner(-chart_height).tickSizeOuter(0);
    const xAxisDraw = this_svg.append('g').attr('class', 'x axis').call(xAxis);
    xAxisDraw.selectAll('text').attr('dy', '0.3em');
    const yAxis = d3.axisLeft(yScale).tickSizeInner(0).tickSizeOuter(0);
    const yAxisDraw = this_svg.append('g').attr('class', 'y axis').call(yAxis);
    yAxisDraw.selectAll('text').attr('dx', '-0.6em');
}

// Setup HTML canvas for people vs disaster type bar chart
function setupPeopleDisasterTypeCanvas(barChartData, startYear, endYear) {
    // clear bar-chart-container-2 space
    d3.select('.bar-chart-container-2').selectAll('svg').remove();

    const svg_width = 500;
    const svg_height = 500;
    const chart_margin = { top: 80, right: 20, bottom: 40, left: 120 };
    const chart_width = svg_width - chart_margin.left - chart_margin.right;
    const chart_height = svg_height - chart_margin.top - chart_margin.bottom;

    const this_svg = d3.select('.bar-chart-container-2').append('svg')
        .attr("width", svg_width).attr("height", svg_height)
        .append("g")
        .attr('transform', `translate(${chart_margin.left}, ${chart_margin.top})`);

    // scale
    // V1.d3.extent find the max & min in people_amount
    const xExtent = d3.extent(barChartData, d => d.people_amount);
    const xScale_v1 = d3.scaleLinear().domain(xExtent).range([0, chart_width]);
    // V2.0 ~ max
    const xMax = d3.max(barChartData, d => d.people_amount);
    const xScale_v2 = d3.scaleLinear().domain([0, xMax]).range([0, chart_width]);
    // V3.Short writing for v2
    const xScale_v3 = d3.scaleLinear([0, xMax], [0, chart_width]);
    // 垂直空間的分配 - 平均分配給各種災害類型
    const yScale = d3.scaleBand().domain(barChartData.map(d => d.disaster_type)).range([0, chart_height]).padding(0.25);

    // Draw bars
    const bars = this_svg.selectAll('.bar')
        .data(barChartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.disaster_type))
        .attr('width', d => xScale_v3(d.people_amount))
        .attr('height', yScale.bandwidth())
        .attr('fill', 'steelblue');

    // Draw header
    const header = this_svg.append('g').attr('class', 'bar-header')
        .attr('transform', `translate(0, ${-chart_margin.top/2})`)
        .append('text');
    header.append('tspan').text('各災害類型罹災人數');
    if (startYear === endYear) {
        header.append('tspan').text(`年份: ${startYear}`)
            .attr('x', 0).attr('y', 20).style('font-size', '0.8em').style('fill', 'gray');
    } else {
        header.append('tspan').text(`年份: ${startYear}~${endYear}`)
            .attr('x', 0).attr('y', 20).style('font-size', '0.8em').style('fill', 'gray');
    }

    // Draw axis
    const xAxis = d3.axisTop(xScale_v3).tickSizeInner(-chart_height).tickSizeOuter(0);
    const xAxisDraw = this_svg.append('g').attr('class', 'x axis').call(xAxis);
    xAxisDraw.selectAll('text').attr('dy', '0.3em');
    const yAxis = d3.axisLeft(yScale).tickSizeInner(0).tickSizeOuter(0);
    const yAxisDraw = this_svg.append('g').attr('class', 'y axis').call(yAxis);
    yAxisDraw.selectAll('text').attr('dx', '-0.6em');

}

// Main
function ready(accidents, startYear, endYear) {
    const accidentsClean = filterData(accidents, startYear, endYear);

    const peopleMainCategoryBarChartData = preparePeopleMainCategoryBarChartData(accidentsClean)
        .sort(
            (a, b) => { return d3.descending(a.people_amount, b.people_amount); }
        );
    setupPeopleMainCategoryCanvas(peopleMainCategoryBarChartData, startYear, endYear);

    const peopleDisasterTypeBarChartData = preparePeopleDisasterTypeBarChartData(accidentsClean)
        .sort(
            (a, b) => { return d3.descending(a.people_amount, b.people_amount); }
        );
    setupPeopleDisasterTypeCanvas(peopleDisasterTypeBarChartData, startYear, endYear);

    console.log(peopleMainCategoryBarChartData);
}

// Load data from csv files under the data folder
// Ref: https://stackoverflow.com/questions/21842384/importing-data-from-multiple-csv-files-in-d3
var concatedFiles = [];
Promise.all([
    d3.csv("data/107.csv", type),
    d3.csv("data/108.csv", type),
    d3.csv("data/109.csv", type),
    d3.csv("data/110.csv", type),
]).then(function(files) {
    // Concat all csv files into one array
    concatedFiles = [];
    files.forEach(element => {
        concatedFiles = concatedFiles.concat(element);
    });
    console.log(concatedFiles);

    const startYear = d3.select('#startYear').property('value');
    const endYear = d3.select('#endYear').property('value');
    ready(concatedFiles, startYear, endYear);


}).catch(function(err) {
    console.log(err);
});

// When update button is clicked, update the chart
d3.select('#control-button').on('click', function() {
    const startYear = d3.select('#startYear').property('value');
    const endYear = d3.select('#endYear').property('value');
    if (startYear > endYear) {
        alert('起始年份不可大於結束年份');
        return;
    }
    ready(concatedFiles, startYear, endYear);
    console.log("Chart updated.");
});