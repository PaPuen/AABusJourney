/*jshint browser:true */
/* eslint-env browser */
/*global Uint8Array, console */
/*global XLSX */
var X = XLSX;
var XW = {
	/* worker message */
	msg: 'xlsx',
	/* worker scripts */
	worker: './xlsxworker.js'
};

var global_wb;
var global_grid;
var journey_out;
var route_legal = new Array();
var bestnum;

function P2Cell(P) {
	var res = new Array();
	res.push( Math.ceil((window.jLatMax - P[0])*1000) );
	res.push( Math.ceil((window.jLngMax - P[1])*1000) );
	return res;
}
function RouteP2Cell(P) {
	var res = new Array();
	res.push( Math.ceil((window.jLatMax - P[7])*1000) );
	res.push( Math.ceil((window.jLngMax - P[8])*1000) );
	return res;
}
function render_grid(rownum, colnum) {
    var grid = new Grid({
        rows: rownum,
        cols: colnum,
        render: {
            placeholder: ".grid"
        }
    });
	window.global_grid = grid;
};

function draw_point (point, color) {
	window.global_grid.getCellAt(point[0], point[1]).$el.css('border-top', '7px solid '+ color);
}
function draw_journey(route, color) {
	var latArray = route.map(function(elt) {return elt[0]; });
	var latMax = Math.max.apply(null, latArray);
	var latMin = Math.min.apply(null, latArray);
	
	var lngArray = route.map(function(elt) {return elt[1]; });
	var lngMax = Math.max.apply(null, lngArray);
	var lngMin = Math.min.apply(null, lngArray);
	
	var grid_num_row = Math.ceil((lngMax - lngMin)*1000) + 3;
	var grid_num_col = Math.ceil((latMax - latMin)*1000) + 3;
	render_grid(grid_num_row, grid_num_col);
	window.jLatMax = latMax;
	window.jLatMin = latMin;
	window.jLngMax = lngMax;
	window.jLngMin = lngMin;
			
	for (var i=0; i < route.length; i++) {
		var point = P2Cell(route[i]);
		draw_point(point, color);
	}

	$("#log").append("<h3>1. Phân tích hành trình...</h3>");
	$("#log").append("<p> Min lat: " + latMin + "</p>");
	$("#log").append("<p> Max lat: " + latMax + "</p>");
	$("#log").append("<p> Min long: " + lngMin + "</p>");
	$("#log").append("<p> Max long: " + lngMax + "</p>");
}

function ReadJourney(path) {
	var request = new XMLHttpRequest();
	request.responseType = "blob";
	request.onreadystatechange = (e) => {
		if (request.readyState !== 4) {
			return;
		}
		if (request.status === 200) {
			console.log('success', request);
		} else {
			console.warn('error');
		}
	};
	
	request.onload = function(oEvent) {
		var blob = request.response;
		var reader = new FileReader();
		reader.onload = function(e) {
			<!-- if(typeof console !== 'undefined') console.log("onload", e); -->
			var data = e.target.result;
			global_wb = X.read(data, {type: 'binary'});
			var output = "";
			var result = {};
			global_wb.SheetNames.forEach(function(sheetName) {
				
				var roa = X.utils.sheet_to_json(global_wb.Sheets[sheetName], {header:1});
				if(roa.length) {
					roa.shift();
					result = roa;
				}
			});
			window.journey_out = result;
			draw_journey(result, '#5da1e6');
			$("#log").append("<h3>2. Phân tích các Route nằm trong khu vực của Journey</h3>");
			for (var i=1; i<=152; i++) {
				ReadRoute("data/Route/"+i+".xlsx", i);
			}
		};
		reader.readAsBinaryString(blob);
	};
	request.open('GET', path);
	request.send();
};

function draw_route(route, color){
	for (var i=0; i < route.length; i++) {
		var point = RouteP2Cell(route[i]);
		draw_point(point, color);
	}
}
function getDistance(p1x, p1y, p2x, p2y) {
	return Math.sqrt(Math.pow(p1x-p2x, 2) + Math.pow(p1y - p2y, 2));
}
function RouteAnalyze_2(route, num) {
	
	var k = journey_out.lengh/2*0.1;
	var journey = journey_out;
	for (var i=0; i<k; i++){
		journey.pop();
		journey.shift();
	} 
	
	var distances = new Array();
	route.map(function(point){
		var mindistance = 10000;
		journey_out.map(function(jpoint){
			var distance = getDistance(jpoint[0], jpoint[1], point[7], point[8]);
			mindistance = (distance < mindistance) ? distance : mindistance;
		});
		distances.push(mindistance*10000);
	});

	var average = distances.reduce((previous, current) => current += previous) / (distances.length);

	var sd = 0;
	distances.map(function(e) {
		sd += Math.pow((e-average), 2);
	});
	sd = Math.sqrt((sd/distances.length));

	$("#log").append("<p>Trung bình các min-distance: "+average+" </p>");
	$("#log").append("<p>Độ lệch chuẩn: "+sd+" </p>");
}

function RouteAnalyze(route, num) {
	var latArray = route.map(function(elt) {return elt[7]; });
	var latMax = Math.max.apply(null, latArray);
	var latMin = Math.min.apply(null, latArray);
	
	var lngArray = route.map(function(elt) {return elt[8]; });
	var lngMax = Math.max.apply(null, lngArray);
	var lngMin = Math.min.apply(null, lngArray);
	if (window.jLatMin<=latMin && window.jLatMax>=latMax && window.jLngMin <= lngMin && window.jLngMax >= lngMax) {
		route_legal.push(route);
		$("#log").append("<p> Route <b>" +num+ "</b> </p>");
		$("#log").append("<p>" + latMin +" "+ latMax +" "+ lngMin +" "+ lngMax + "</p>");

		var letters = '0123456789ABCDEF';
		  var color = '#';
		  for (var i = 0; i < 6; i++) {
			color += letters[Math.floor(Math.random() * 16)];
		  }
		draw_route(route, color);
		RouteAnalyze_2(route, num);
	}
}

function ReadRoute(path, num) {
	var request = new XMLHttpRequest();
	request.responseType = "blob";
	request.onreadystatechange = (e) => {
		if (request.readyState !== 4) {
			return;
		}
		if (request.status === 200) {
		} else {
			console.warn('error');
		}
	};
	
	request.onload = function(oEvent) {
		var blob = request.response;
		var reader = new FileReader();
		reader.onload = function(e) {
			<!-- if(typeof console !== 'undefined') console.log("onload", e); -->
			var data = e.target.result;
			_wb = X.read(data, {type: 'binary'});
			var result = {};
			_wb.SheetNames.forEach(function(sheetName) {
				var roa = X.utils.sheet_to_json(_wb.Sheets[sheetName], {header:1});
				if(roa.length) {
					roa.shift();
					result = roa;
				}
			});
			RouteAnalyze(result, num);
		};
		reader.readAsBinaryString(blob);
	};
	request.open('GET', path);
	request.send();
};

function DoJourney17(){
	$(".grid").empty();
	$("#log").empty();
	ReadJourney( "data/Journey/51B02517.xlsx");
}
function DoJourney63(){
	$(".grid").empty();
	$("#log").empty();
	ReadJourney( "data/Journey/51B02635.xlsx");
}