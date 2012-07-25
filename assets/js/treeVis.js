var App = App || {};

App.stepToTreeViewFmt = function (step) {
	return App.nodeToTreeViewFmtRecursive(step.get("node"));
};

App.nodeToTreeViewFmtRecursive = function (node) {
	var obj = {};

	obj.id = node.cid;
	obj.name = node.get("symbol");

	if (node.get("left") !== null) {
		obj.children = []; // create the children array
		obj.children.push(App.nodeToTreeViewFmtRecursive(node.get("left")));
	}

	if (node.get("right") !== null) {
		obj.children = obj.children || []; // create children array if no left
		obj.children.push(App.nodeToTreeViewFmtRecursive(node.get("right")));
	}

	return obj;
}
/*
App.TreeVis = Backbone.Model.extend({

});

App.TreeVisView = Backbone.View.extend({

});
*/


var notNotATreeData = {
	"id" : 21,
	"name": "\u00AC",
	"children": [
		{
			"id" : 33,
			"name" : "\u00AC",
			"children" : [
				{
					"id" : 200,
					"name" : "A"
				}
			]
		}
	]
};

var longTreeData = {
	"id": 1,
	"name": "\u2192",
	"children": [
		{
			"id" : 2,
			"name" : "\u2227",
			"children" : [
				{
					"id" : 3,
					"name" : "A"
				},
				{
					"id" : 4,
					"name" : "B"
				}
			]
		},{
			"id" : 5,
			"name" : "\u2227",
			"children" : [
				{
					"id" : 6,
					"name" : "hasOffice(X,Y,Z,L,M,N)"
				},
				{
					"id" : 7,
					"name" : "hasOffice(X,Y,Z,L,M,N)"
				}
			]
		}
	]
};

var longTreeDataChanged = {
	"id": 1,
	"name": "\u2192",
	"children": [
		{
			"id" : 2,
			"name" : "\u2227",
			"children" : [
				{
					"id" : 3,
					"name" : "A",
					"children" : [
						{
							"id" : 9,
							"name" : "Z"
						},{
							"id" : 10,
							"name" : "X"
						}
					]
				},
				{
					"id" : 4,
					"name" : "B"
				}
			]
		},{
			"id" : 5,
			"name" : "\u2227",
			"children" : [
				{
					"id" : 8,
					"name" : "C"
				},
				{
					"id" : 7,
					"name" : "hasOffice(X,Y,Z,L,M,N)"
				}
			]
		}
	]
};



// Go through the data and create id : [all descendant ids] within descendantsLookup
function createDescendantLookup(json, ancestors) {
	// Add an ancestor.id : this.id pair to descendants lookup 
	ancestors.forEach(function (ancestor) {
		descendantsLookup[ancestor].push(json.id); 
	});

	if (json.children) {
		descendantsLookup[json.id] = [];
		ancestors.push(json.id);

		json.children.forEach(function (child) {
			createDescendantLookup(child, ancestors);
		});

		ancestors.pop();
	}
}

// Returns true if id a is a descendant of the id b
function isDescendantOf(a, b){
	if (a === b) return true
	if (descendantsLookup[b]) {
		if (descendantsLookup[b].indexOf(a) >= 0) return true;
	}
	return false;
}

var descendantsLookup = {};

var width = 300,
	height = 200;

var tree = d3.layout.tree()
			.size([width, height - 30])
			.separation(function (a,b) {
				return a.parent == b.parent ? Math.max(1, Math.floor((b.name.length + a.name.length)/13)) : 2;
			});

var diagonal = d3.svg.diagonal();

var vis = d3.select("#chart").append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
			.attr("transform", "translate(-25, 15)"); //shifts everything down in g by 40px

root = longTreeData;

update(longTreeData);

var nodes, node, nodeEnter;

function update(source) {
	if (node) {
		removeAllHighlights();
	}

	// Create the new descendantsLookup obj
	descendantsLookup = {};
	createDescendantLookup(source,[]);

	// Compute the new tree layout
	nodes = tree.nodes(source);

	 // Update the nodes…
  	node = vis.selectAll("g.node")
      .data(nodes, function(d) { return d.id; });

    nodeEnter = node.enter().append("g")
    	.attr("class", "node")
    	.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
		.style("fill-opacity", 0)
		.style("stroke-opacity", 0)
    	.on("click", click);

    nodeEnter.append("rect")
		.attr("height", 20)
		.attr("width", function (d) { return 20 + (d.name.length > 1 ? d.name.length * 4.4 : 0); }) // base width of rectangle on length of name to be displayed
		.attr("transform", function (d) { var dist = -10 + -(d.name.length > 1 ? d.name.length * 2.2 : 0); return "translate("+ dist +",-10)"} ) // move half back
		.attr("rx", 10)
		.attr("ry", 10); // round the corners

	nodeEnter.append("text")
		.attr("dx", function (d) { return -4 - (d.name.length > 1 ? d.name.length * 2.2 : 0) })
		.attr("dy", 3)
		.attr("text-anchor", "start")
		.text(function(d) { return d.name; });

	

	// Transition nodes to their new position.
	nodeUpdate = node.transition()
		.duration(1000)
		.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

	// Transition old nodes - fade out
	nodeExit = node.exit().transition()
		.duration(400)
		.style("fill-opacity", 0)
		.style("stroke-opacity", 0)
		.remove();

	// Update the links…
	var link = vis.selectAll("path.link")
		.data(tree.links(nodes), function(d) { return d.target.id; });

	// Enter any new links at the parent's previous position.
	link.enter().insert("path", "g")
		.attr("class", "link")
		.attr("d", function(d) {
			var o = { x: d.source.x, y: d.source.y };
			return diagonal({source: o, target: o});
		});

	// Transition links to their new position.
	link.transition()
		.duration(1000)
		.attr("d", diagonal);

	// Transition exiting nodes fade out
	link.exit().transition()
		.duration(400)
		.style("stroke-opacity", 0)
		.remove();

	nodeEnter.transition()
		.duration(400)
		.style("fill-opacity", 1)
		.style("stroke-opacity", 1);
}

function click(d) {
	highlightFromId(d.id);
}

function highlightFromId(id) {
	node.each(function(o) {
		d3.select(this).select("rect").classed("highlighted", isDescendantOf(o.id, id));
	});
}

function removeAllHighlights() {
	node.each(function(o){
		d3.select(this).select("rect").classed("highlighted", false);
	})
}