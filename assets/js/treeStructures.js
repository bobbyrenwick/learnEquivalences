var App = App || {};

App.Node = Backbone.Model.extend({
	defaults: {
		truth: false,
		precedence: 10000,
		left: null,
		right: null,
		selected: false
	},

	initialize: function () {
		this.on("error", this.logError);
	},

	truthValue: function () {
		return this.get("truth");
	},

	toString: function () {
		return this.get("symbol");
	},

	// Builds an array of arrays that represent the atoms that are present in a node
	getAtoms: function (arr) {
		var curSymbol = this.get("symbol"),
			alreadyExists = _.find(arr, function (elem) {
				return elem.symbol === curSymbol;
			}),
			atomArr = [],
			atomObj = { "symbol" : this.get("symbol") };

			// If the symbol already exists in the array add this symbol to list of refs

		if (!(_.isUndefined(alreadyExists))) {
			alreadyExists.objects.push(this);
			return;
		}

		atomArr.push(this);
		atomObj.objects = atomArr;
		arr.push(atomObj);
	},

	getSubFormulae: function (arr) {
		arr.push(this);
			return;
	},

	deepClone: function () {
		return this.clone();
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return this.clone();
	}
});

App.Constant = App.Node.extend({
	// As getAtoms is used for checking equivalence by manipulating the
	// truth values of the atoms, constants don't need to be included.
	getAtoms: function (arr) {
		return;
	}
});

App.Contradiction = App.Constant.extend({
	defaults: {
		symbol: "⊥",
		truth: false,
		precedence: 10000,
		left: null,
		right: null,
		selected: false
	}
});

App.Tautology = App.Constant.extend({
	defaults: {
		symbol: "⊤",
		truth: true,
		precedence: 10000,
		left: null,
		right: null,
		selected: false
	}
});

App.UnaryNode = App.Node.extend({
	toString: function () {
		var stringBuilder = [],
			rightLower = this.get("right").get("precedence") < this.get("precedence");

		stringBuilder.push(this.get("symbol"));
		if (rightLower) {
			stringBuilder.push("(");
		}
		stringBuilder.push(this.get("right").toString());
		if (rightLower) {
			stringBuilder.push(")");
		}

		return stringBuilder.join("");
	},

	getAtoms: function (arr) {
		// As UnaryNode's only have atoms to the left, just find atoms to the right.
		this.get("right").getAtoms(arr);
		return;
	},

	deepCloneObj: function () {
		return {
			right: this.get("right").deepClone()
		};
	},

	deepCloneReplaceObj: function (subToReplace, subToReplaceWith) {
		return {
			right: this.get("right").deepCloneReplace(subToReplace, subToReplaceWith)
		};
	},

	getSubFormulae: function (arr) {
		arr.push(this);
		this.get("right").getSubFormulae(arr);
		return;
	}
});

App.NegationNode = App.UnaryNode.extend({
	defaults: {
		symbol: "¬",
		precedence: 9000,
		left: null,
		selected: false
	},

	truthValue: function () {
		return !(this.get("right").truthValue());
	},

	deepClone: function () {
		return new App.NegationNode(this.deepCloneObj());
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return new App.NegationNode(this.deepCloneReplaceObj(subToReplace, subToReplaceWith));
	}
});

App.BinaryNode = App.Node.extend({
	toString: function () {
		var stringBuilder = [],
			leftNotHigher = this.get("left").get("precedence") <= this.get("precedence"),
			rightNotHigher = this.get("right").get("precedence") <= this.get("precedence");

		if (leftNotHigher) {
			stringBuilder.push("(");
		}
		stringBuilder.push(this.get("left").toString());
		if (leftNotHigher) {
			stringBuilder.push(")");
		}

		stringBuilder.push(" ");
		stringBuilder.push(this.get("symbol"));
		stringBuilder.push(" ");

		if (rightNotHigher) {
			stringBuilder.push("(");
		}
		stringBuilder.push(this.get("right").toString());
		if (rightNotHigher) {
			stringBuilder.push(")");
		}

		return stringBuilder.join("");
	},

	getAtoms: function (arr) {
		this.get("left").getAtoms(arr);
		this.get("right").getAtoms(arr);
		return;
	},

	getSubFormulae: function (arr) {
		this.get("left").getSubFormulae(arr);
		arr.push(this);
		this.get("right").getSubFormulae(arr);
		return;
	},

	deepCloneObj: function (arr) {
		return {
			left: this.get("left").deepClone(),
			right: this.get("right").deepClone()
		};
	},

	deepCloneReplaceObj: function (subToReplace, subToReplaceWith) {
		return {
			left: this.get("left").deepCloneReplace(subToReplace, subToReplaceWith),
			right: this.get("right").deepCloneReplace(subToReplace, subToReplaceWith)
		};
	}
});

App.AndNode = App.BinaryNode.extend({
	defaults: {
		symbol: "∧",
		precedence: 8000,
		selected: false
	},

	truthValue: function () {
		return (this.get("left").truthValue() && this.get("right").truthValue());
	},

	deepClone: function () {
		return new App.AndNode(this.deepCloneObj());
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return new App.AndNode(this.deepCloneReplaceObj(subToReplace, subToReplaceWith));
	}

});

App.OrNode = App.BinaryNode.extend({
	defaults: {
		symbol: "∨",
		precedence: 7000,
		selected: false
	},

	truthValue: function () {
		return (this.get("left").truthValue() || this.get("right").truthValue());
	},

	deepClone: function () {
		return new App.OrNode(this.deepCloneObj());
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return new App.OrNode(this.deepCloneReplaceObj(subToReplace, subToReplaceWith));
	}

});

App.ImplyNode = App.BinaryNode.extend({
	defaults: {
		symbol: "→",
		precedence: 6000,
		selected: false
	},

	truthValue: function () {
		return ((!this.get("left").truthValue()) || this.get("right").truthValue());
	},

	deepClone: function () {
		return new App.ImplyNode(this.deepCloneObj());
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return new App.ImplyNode(this.deepCloneReplaceObj(subToReplace, subToReplaceWith));
	}
});

App.DimplyNode = App.BinaryNode.extend({
	defaults: {
		symbol: "↔",
		precedence: 5000,
		selected: false
	},

	truthValue: function () {
		return ((!(this.get("left").truthValue()) || this.get("right").truthValue()) && (!(this.get("right").truthValue()) || this.get("left").truthValue()));
	},

	deepClone: function () {
		return new App.DimplyNode(this.deepCloneObj());
	},

	deepCloneReplace: function (subToReplace, subToReplaceWith) {
		if (this === subToReplace) {
			return subToReplaceWith;
		}
		return new App.DimplyNode(this.deepCloneReplaceObj(subToReplace, subToReplaceWith));
	}
});

App.NodeView = Backbone.View.extend({
	tagName: "span",

	render: function () {
		var renderedContent =  this.template(this.model.toJSON());
		this.$el.html(renderedContent);
		return this;
	},

	// Recursive version of render that builds a span set with 
	// hierachy that represents the hierachy of nodes

	deepRender: function () {
		// Render this node
		this.render();

		// If there is a node to the left of this one make sure to deeprender this too
		if (this.leftView !== null) {
			this.$el.children(".left").append(this.leftView.deepRender().el);
		}
		// If there is a node to the right of this one make sure to deeprender this too
		if (this.rightView !== null) {
			this.$el.children(".right").append(this.rightView.deepRender().el);
		}
		return this;
	}
});

App.AnswerNodeView = App.NodeView.extend({

	className: "node",
	template: _.template($("#comboNodeTemplate").html()),

	events: {
		"mouseenter .symbol" : "symbolEnter",
		"mouseleave .symbol" : "symbolLeave",
		"click .symbol" : "symbolClick"
	},

	initialize: function () {
		// If there is a node to the left, create a view for it
		if (this.model.get("left") !== null) {
			this.leftView = new App.AnswerNodeView({ model: this.model.get("left") });
		} else {
			this.leftView = null;
		}

		// Similarly but for the right
		if (this.model.get("right") !== null) {
			this.rightView = new App.AnswerNodeView({ model: this.model.get("right") });
		} else {
			this.rightView = null;
		}
		this.model.on("change:selected", this.onChangeSelected, this);
	},

	// All the following event handlers pass on the responsibility to the collection
	// view to deal with because

	symbolEnter: function (e) {
		e.stopPropagation();
		this.trigger("symbolEnterToStep", this);
	},

	symbolLeave: function (e) {
		e.stopPropagation();
		this.trigger("symbolLeaveToStep", this);
	},

	symbolClick: function (e) {
		e.stopPropagation();
		this.trigger("symbolClickToStep", this);
	},

	// A recursive version of bind that ensures that all AnswerNodeViews within
	// this one have their own version of the event handler.
	// Similar to deepRender implementation.
	// Takes the same parameters as Backbone's normal bind fn

	bindAll: function (eventName, func, context) {
		this.bind(eventName, func, context);

		if (this.leftView !== null) {
			this.leftView.bindAll(eventName, func, context);
		}

		if (this.rightView !== null) {
			this.rightView.bindAll(eventName, func, context);
		}
	},

	// Reacts to a change in the model's selected property
	// Adding the yellow highlighted class if it is selected,
	// And making sure it is removed if it is not selected.

	onChangeSelected: function () {
		if (this.model.get("selected")) {
			this.$el.addClass("highlighted");
		} else {
			this.$el.removeClass("highlighted");
		}
	}
});