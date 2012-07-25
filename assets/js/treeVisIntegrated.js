var App = App || {};

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

// default svg id is chart
App.TreeVis = function (data, svgid, width, height) {

	this.width = width;
	this.height = height;
	this.data = data;
	this.svgid = "#" + svgid;

	// Create the new descendantsLookup obj
	this.descendantsLookup = {};
	this.createDescendantLookup(this.data,[]);

	this.tree = d3.layout.tree()
			.size([this.width, this.height - 30])
			.separation(function (a,b) {
				return a.parent == b.parent ? Math.max(1, Math.floor((b.name.length + a.name.length)/13)) : 2;
			});

	this.diagonal = d3.svg.diagonal();

	this.vis = d3.select(this.svgid).append("svg")
			.attr("width", this.width)
			.attr("height", this.height)
			.append("g")
			.attr("transform", "translate(-25, 15)"); //shifts everything down in g by 40px and to the left by 25px

	this.updateTree();
};

App.TreeVis.prototype.resizeSvg = function (width, height) {

	this.width = width;
	this.height = height;

	this.tree = d3.layout.tree()
			.size([this.width, this.height - 30])
			.separation(function (a,b) {
				return a.parent == b.parent ? Math.max(1, Math.floor((b.name.length + a.name.length)/13)) : 2;
			});

	this.vis = d3.select(this.svgid + ">svg")
		.attr("width", this.width)
		.attr("height", this.height)
		.select("g");

	this.updateTree();

}

App.TreeVis.prototype.updateData = function (newData) {
	this.data = newData;
	// Create the new descendantsLookup obj
	this.descendantsLookup = {};
	this.createDescendantLookup(this.data,[]);

	this.removeAllHighlights();
	this.updateTree();
};

// Go through the data and create id : [all descendant ids] within this.descendantsLookup
App.TreeVis.prototype.createDescendantLookup = function (json, ancestors) {
	var self = this;
	// Add an ancestor.id : this.id pair to descendants lookup 
	ancestors.forEach(function (ancestor) {
		self.descendantsLookup[ancestor].push(json.id); 
	});

	if (json.children) {
		this.descendantsLookup[json.id] = [];
		ancestors.push(json.id);

		json.children.forEach(function (child) {
			self.createDescendantLookup(child, ancestors);
		});

		ancestors.pop();
	}
};

// Returns true if id a is a descendant of the id b
App.TreeVis.prototype.isDescendantOf = function (a, b) {
	if (a === b) { return true; }
	if (this.descendantsLookup[b]) {
		if (this.descendantsLookup[b].indexOf(a) >= 0) return true;
	}
	return false;
};

// Functions for converting from a Backbone step into the format required by d3
App.TreeVis.prototype.stepToTreeViewFmt = function (step) {
	return App.TreeVis.nodeToTreeViewFmtRecursive(step.get("node"));
};

App.TreeVis.prototype.nodeToTreeViewFmtRecursive = function (node) {
	var obj = {};

	obj.id = node.cid;
	obj.name = node.get("symbol");

	if (node.get("left") !== null) {
		obj.children = []; // create the children array
		obj.children.push(App.TreeVis.nodeToTreeViewFmtRecursive(node.get("left")));
	}

	if (node.get("right") !== null) {
		obj.children = obj.children || []; // create children array if no left
		obj.children.push(App.TreeVis.nodeToTreeViewFmtRecursive(node.get("right")));
	}

	return obj;
};

App.TreeVis.prototype.updateTree = function() {
	var self = this;

	// Compute the new tree layout
	this.nodes = this.tree.nodes(this.data);

	 // Update the nodes…
  	this.node = this.vis.selectAll("g.node")
      .data(this.nodes, function(d) { return d.id; });

    this.nodeEnter = this.node.enter().append("g")
    	.attr("class", "node")
    	.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
		.style("fill-opacity", 0)
		.style("stroke-opacity", 0)
    	.on("click", function (d) {
    		self.highlightFromId(d.id);
    	});

    this.nodeEnter.append("rect")
		.attr("height", 20)
		.attr("width", function (d) { return 20 + (d.name.length > 1 ? d.name.length * 4.4 : 0); }) // base width of rectangle on length of name to be displayed
		.attr("transform", function (d) { var dist = -10 + -(d.name.length > 1 ? d.name.length * 2.2 : 0); return "translate("+ dist +",-10)"} ) // move half back
		.attr("rx", 10)
		.attr("ry", 10); // round the corners

	this.nodeEnter.append("text")
		.attr("dx", function (d) { return -4 - (d.name.length > 1 ? d.name.length * 2.2 : 0) })
		.attr("dy", 3)
		.attr("text-anchor", "start")
		.text(function(d) { return d.name; });

	// Transition nodes to their new position.
	this.nodeUpdate = this.node.transition()
		.duration(1000)
		.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

	// Transition old nodes - fade out
	this.nodeExit = this.node.exit().transition()
		.duration(400)
		.style("fill-opacity", 0)
		.style("stroke-opacity", 0)
		.remove();

	// Update the links…
	this.link = this.vis.selectAll("path.link")
		.data(this.tree.links(this.nodes), function(d) { return d.target.id; });

	// Enter any new links at the parent's previous position.
	this.link.enter().insert("path", "g")
		.attr("class", "link")
		.attr("d", function(d) {
			var o = { x: d.source.x, y: d.source.y };
			return self.diagonal({source: o, target: o});
		});

	// Transition links to their new position.
	this.link.transition()
		.duration(1000)
		.attr("d", this.diagonal);

	// Transition exiting nodes fade out
	this.link.exit().transition()
		.duration(400)
		.style("stroke-opacity", 0)
		.remove();

	this.nodeEnter.transition()
		.duration(400)
		.style("fill-opacity", 1)
		.style("stroke-opacity", 1);
}

App.TreeVis.prototype.highlightFromId = function (id) {
	var self = this;
	this.node.each(function(o) {
		d3.select(this).select("rect").classed("highlighted", self.isDescendantOf(o.id, id));
	});
};

App.TreeVis.prototype.removeAllHighlights = function () {
	this.node.each(function(o){
		d3.select(this).select("rect").classed("highlighted", false);
	});
};