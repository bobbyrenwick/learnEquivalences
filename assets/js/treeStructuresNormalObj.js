var App = App || {};

// Takes a backbone model formula and returns an equivalent js object.
App.backboneToNormal = function (formula) {
	if (formula instanceof App.DimplyNode) {
		return new App.DimplyNodeNormal(App.backboneToNormal(formula.get("left")),
			App.backboneToNormal(formula.get("right")));
	} else if (formula instanceof App.ImplyNode) {
		return new App.ImplyNodeNormal(App.backboneToNormal(formula.get("left")),
			App.backboneToNormal(formula.get("right")));
	} else if (formula instanceof App.AndNode) {
		return new App.AndNodeNormal(App.backboneToNormal(formula.get("left")),
			App.backboneToNormal(formula.get("right")));
	} else if (formula instanceof App.OrNode) {
		return new App.OrNodeNormal(App.backboneToNormal(formula.get("left")),
			App.backboneToNormal(formula.get("right")));
	} else if (formula instanceof App.NegationNode) {
		return new App.NegationNodeNormal(App.backboneToNormal(formula.get("right")));
	} else if (formula instanceof App.Tautology) {
		return new App.TautologyNormal();
	} else if (formula instanceof App.Contradiction) {
		return new App.ContradictionNormal();
	} else { // formula is a node
		return new App.NodeNormal(formula.get("symbol"));
	}
}

App.NodeNormal = function (symbol) {
	// defaults
	this.precedence = 10000;
	this.left = null;
	this.right = null;
	this.symbol = symbol;
};

App.NodeNormal.prototype = {
	toString : function () { return this.symbol; },

	getSubFormulae : function (arr) {
		arr.push(this);
	},

	deepClone : function () { return _.clone(this); },

	deepCloneReplace : function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) { return subToReplaceWith; }
		return _.clone(this);
	}
};

App.ContradictionNormal = function () {
	this.symbol = "⊥";
	this.precedence = 10000;
	this.left = null;
	this.right = null;
};

App.ContradictionNormal.prototype = new App.NodeNormal();

App.TautologyNormal = function () {
	this.symbol = "⊤";
	this.precedence = 10000;
	this.left = null;
	this.right = null;
};

App.TautologyNormal.prototype = new App.NodeNormal();

App.UnaryNodeNormal = function () {};

App.UnaryNodeNormal.prototype = {
	toString : function () {
		var str = "",
			rightLower = this.right.precedence < this.precedence;

		str += this.symbol;
		if (rightLower) {
			str += "(";
		}
		str += this.right.toString();
		if (rightLower) {
			str += ")";
		}

		return str;
	},

	getSubFormulae : function (arr) {
		arr.push(this);
		this.right.getSubFormulae(arr);
	},

	deepCloneRight : function () {
		return this.right.deepClone();
	},

	deepCloneReplaceRight : function (subToReplace, subToReplaceWith) {
		return this.right.deepCloneReplace(subToReplace, subToReplaceWith);
	}
};

App.NegationNodeNormal = function (right) {
	this.symbol = "¬";
	this.precedence = 9000;
	this.left = null;
	this.right = right;
}

App.NegationNodeNormal.prototype = new App.UnaryNodeNormal();

App.NegationNodeNormal.prototype.deepClone = function () {
	return new App.NegationNodeNormal(this.deepCloneRight());
};

App.NegationNodeNormal.prototype.deepCloneReplace = function (subToReplace, subToReplaceWith) {
	if (this === subToReplace) { return subToReplaceWith; }
	return new App.NegationNodeNormal(this.deepCloneRight());
};

App.BinaryNodeNormal = function () {};

App.BinaryNodeNormal.prototype = {
	toString : function () {
		var str = "",
			leftNotHigher = this.left.precedence <= this.precedence,
			rightNotHigher = this.right.precedence <= this.precedence;

		if (leftNotHigher) {
			str += "(";
		}
		str += this.left.toString();
		if (leftNotHigher) {
			str += ")";
		}

		str += " ";
		str += this.symbol;
		str += " ";

		if (rightNotHigher) {
			str += "(";
		}
		str += this.right.toString();
		if (rightNotHigher) {
			str += ")";
		}

		return str;
	},

	getSubFormulae : function (arr) {
		this.left.getSubFormulae(arr);
		arr.push(this);
		this.right.getSubFormulae(arr);
		return;
	},

	deepCloneRight : function () {
		return this.right.deepClone();
	},

	deepCloneLeft : function () {
		return this.left.deepClone();
	},

	deepCloneReplaceRight : function (subToReplace, subToReplaceWith) {
		return this.right.deepCloneReplace(subToReplace, subToReplaceWith);
	},

	deepCloneReplaceLeft : function (subToReplace, subToReplaceWith) {
		return this.left.deepCloneReplace(subToReplace, subToReplaceWith);
	}
};

App.AndNodeNormal = function (left, right) {
	this.symbol = "∧";
	this.precedence = 8000;
	this.left = left;
	this.right = right;
};

App.AndNodeNormal.prototype = new App.BinaryNodeNormal();

App.AndNodeNormal.prototype.deepClone = function () {
	return new App.AndNodeNormal(this.deepCloneLeft(), this.deepCloneRight());
};

App.AndNodeNormal.prototype.deepCloneReplace = function (subToReplace, subToReplaceWith) {
	if (this === subToReplace) { return subToReplaceWith; }
	return new App.AndNodeNormal(this.deepCloneReplaceLeft(subToReplace, subToReplaceWith), 
		this.deepCloneReplaceRight(subToReplace, subToReplaceWith));
};

App.OrNodeNormal = function (left, right) {
	this.symbol = "∨";
	this.precedence = 7000;
	this.left = left;
	this.right = right;
};

App.OrNodeNormal.prototype = new App.BinaryNodeNormal();

App.OrNodeNormal.prototype.deepClone = function () {
	return new App.OrNodeNormal(this.deepCloneLeft(), this.deepCloneRight());
};

App.OrNodeNormal.prototype.deepCloneReplace = function (subToReplace, subToReplaceWith) {
	if (this === subToReplace) { return subToReplaceWith; }
	return new App.OrNodeNormal(this.deepCloneReplaceLeft(subToReplace, subToReplaceWith), 
		this.deepCloneReplaceRight(subToReplace, subToReplaceWith));
};

App.ImplyNodeNormal = function (left, right) {
	this.symbol = "→";
	this.precedence = 6000;
	this.left = left;
	this.right = right;
};

App.ImplyNodeNormal.prototype = new App.BinaryNodeNormal();

App.ImplyNodeNormal.prototype.deepClone = function () {
	return new App.ImplyNodeNormal(this.deepCloneLeft(), this.deepCloneRight());
};

App.ImplyNodeNormal.prototype.deepCloneReplace = function (subToReplace, subToReplaceWith) {
	if (this === subToReplace) { return subToReplaceWith; }
	return new App.ImplyNodeNormal(this.deepCloneReplaceLeft(subToReplace, subToReplaceWith), 
		this.deepCloneReplaceRight(subToReplace, subToReplaceWith));
};

App.DimplyNodeNormal = function (left, right) {
	this.symbol = "↔";
	this.precedence = 5000;
	this.left = left;
	this.right = right;
};

App.DimplyNodeNormal.prototype = new App.BinaryNodeNormal();

App.DimplyNodeNormal.prototype.deepClone = function () {
	return new App.DimplyNodeNormal(this.deepCloneLeft(), this.deepCloneRight());
};

App.DimplyNodeNormal.prototype.deepCloneReplace = function (subToReplace, subToReplaceWith) {
	if (this === subToReplace) { return subToReplaceWith; }
	return new App.DimplyNodeNormal(this.deepCloneReplaceLeft(subToReplace, subToReplaceWith), 
		this.deepCloneReplaceRight(subToReplace, subToReplaceWith));
};


App.testClone = function (formula) {
	var test,
		normalFormula = App.backboneToNormal(formula);

	console.time("backbone");
	for (var i = 0; i < 1000000; i++) {
		test = formula.deepClone();
	}
	console.timeEnd("backbone");

	console.time("normal");
	for (var i = 0; i < 1000000; i++) {
		test = normalFormula.deepClone();
	}
	console.timeEnd("normal");

}