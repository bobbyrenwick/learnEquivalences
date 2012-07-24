var App = App || {};

Backbone.View.prototype.close = function () {
	if (this.onClose) {
		this.onClose();
	}
	this.remove();
	this.unbind();
};

App.ModalView = Backbone.View.extend({

	// Inserts connective into the last selected text input after the position
	// of the cursor
	insertConnective: function (connective) {
		var currentValue;
		if (this.$lastFocus !== false) {
			currentValue = this.$lastFocus.val();
			this.$lastFocus.val(currentValue.substring(0, this.lastPos) + connective + currentValue.substring(this.lastPos)).focus().setCursorPosition(this.lastPos + 1);
		}
	},

	// Records the jQuery object of the element last selected and the caret position
	onTextBlur: function (e) {
		this.$lastFocus = $(e.target);
		this.lastPos = this.$lastFocus.getCursorPosition();
	},

	closeToolbar: function () {
		this.connectiveToolbar.unbind("btnClicked", this.insertConnective);
		this.connectiveToolbar.close();
	},

	onClose: function () {
		this.$modalView.modal('hide');
		if (this.connectiveToolbar) {
			this.closeToolbar();
		}
	}
});

App.InExerciseModalView = App.ModalView.extend({
	failClose: function (e) {
		e.stopPropagation();
		e.preventDefault();

		this.trigger("modalChooseFail", {
			modal: this
		});
		this.close();
	},

	renderSubFIntroFormBlocks: function (symbols, options) {
		var self = this;

		_.each(symbols, function (introSymbol, i) {
			// For each symbol that needs to be replaced by a subF, create a form
			// element that allows for clicking
			var prevNo = options.prevNo || 0,
				subFIntroFormBlock = new App.SubFIntroFormBlockView({
					model: new App.SubFIntroFormBlock({
						showIntroduce: options.showIntroduce,
						collapseWhenDone: options.collapseWhenDone,
						// If the label is Formula to replace 
						label: (options.label[0] === "F" ? options.label + introSymbol : options.label),
						"i": i + prevNo
					})
				});
			self.$("fieldset").append(subFIntroFormBlock.render().$el);
			if (options.formBlocks !== undefined) {
				options.formBlocks.push(subFIntroFormBlock);
			}
			subFIntroFormBlock.bind("subFIntroSuccess", self.onSubFIntroSuccess, self);
		});
	}
});

/* This is a modal for choosing the direction in which an equivalence rule should be applied.
	Handles when either/both sides require the introduction of new wffs.
	Supplied with the following:
			"node" : node,
			"step" : step,
			"eqRule" : eqRule,
			"bwdMatchingPairs" : bwdMatchingPairs,
			"fwdMatchingPairs" : fwdMatchingPairs
		*/
App.EqRuleDirChooseModal = Backbone.Model.extend({

	initialize: function () {
		this.set({
			// create local copies of the symbols requiring introduction as need to modify them to check when all
			// formulas have been introduced
			bwdIntroSymbols: this.get("eqRule").get("bwdIntroSymbols").slice(0),
			fwdIntroSymbols: this.get("eqRule").get("fwdIntroSymbols").slice(0),
			// If no intoduction is required, find the resulting entire formula
			bwdResult: (this.get("eqRule").get("bwdIntroSymbols").length === 0 ? this.get("eqRule").applyRule(-1, this.get("bwdMatchingPairs"), this.get("node"), this.get("step").get("node")) : false),
			fwdResult: (this.get("eqRule").get("fwdIntroSymbols").length === 0 ? this.get("eqRule").applyRule(1, this.get("fwdMatchingPairs"), this.get("node"), this.get("step").get("node")) : false)
		});
	}
});

App.EqRuleDirChooseModalView = App.InExerciseModalView.extend({
	template: _.template($("#eqRuleDirChooseModalTemplate").html()),

	events: {
		"blur input": "onTextBlur",
		"click .btn-close": "failClose",
		"click .close": "failClose",
		"click .btn-success": "successClose",
		"click .btn-info": "successClose"
	},

	initialize: function () {
		this.$lastFocus = false;
		this.lastPos = 0;
		this.errors = 0;

		this.$modalView = $("#eqRuleDirChooseModal");

		// If either side of the equivalence rule needs an introduction, create a connectiveToolbar
		if (!this.model.get("bwdResult") || !this.model.get("fwdResult")) {
			this.connectiveToolbar = new App.ConnectiveToolbarView();
			this.connectiveToolbar.bind("btnClicked", this.insertConnective, this);
		}

		// If either already has a result, create a form view for this completed tree
		if (this.model.get("fwdResult")) {
			this.fwdWffFormBlockView = new App.WffFormBlockView({
				model: new App.WffFormBlock({
					label: "Next Step",
					node: this.model.get("fwdResult").toString()
				})
			});
		} else {
			this.fwdSubFIntroFormBlocks = [];
		}

		if (this.model.get("bwdResult")) {
			this.bwdWffFormBlockView = new App.WffFormBlockView({
				model: new App.WffFormBlock({
					label: "Next Step",
					node: this.model.get("bwdResult").toString()
				})
			});
		} else {
			this.bwdSubFIntroFormBlocks = [];
		}

	},

	render: function () {
		var renderedContent = this.template({
			rule: this.model.get("eqRule").get("rule"),
			node: this.model.get("node").toString(),

			fwdResult: this.model.get("fwdResult"),
			bwdResult: this.model.get("bwdResult"),

			fwdMultipleSymbols: this.model.get("eqRule").get("fwdIntroSymbols").length > 1,
			fwdIntroSymbolsCS: this.model.get("eqRule").get("fwdIntroSymbols").join(", "),

			bwdMultipleSymbols: this.model.get("eqRule").get("bwdIntroSymbols").length > 1,
			bwdIntroSymbolsCS: this.model.get("eqRule").get("bwdIntroSymbols").join(", ")
		}),
			self = this;

		this.$el.html(renderedContent);

		if (!this.model.get("fwdResult") || !this.model.get("bwdResult")) {
			// Add the connective toolbar
			this.$('fieldset').append(this.connectiveToolbar.render().$el);
		}

		this.$("fieldset").append("<h4 class=\"green\">LTR application</h4>");
		if (!this.model.get("fwdResult")) {
			// Render all the inputs needed for the forwards application
			this.renderSubFIntroFormBlocks(this.model.get("fwdIntroSymbols"), {
				formBlocks: this.fwdSubFIntroFormBlocks,
				showIntroduce: true,
				collapseWhenDone: true,
				label: "Formula to replace "
			});
		} else {
			// We already have a result for the forwards application, render a plain text form place
			this.$("fieldset").append(this.fwdWffFormBlockView.render().$el);
		}

		this.$("fieldset").append("<h4 class=\"blue\">RTL application</h4>");

		if (!this.model.get("bwdResult")) {
			this.renderSubFIntroFormBlocks(this.model.get("bwdIntroSymbols"), {
				formBlocks: this.bwdSubFIntroFormBlocks,
				prevNo: (this.fwdSubFIntroFormBlocks ? this.fwdSubFIntroFormBlocks.length : 0),
				showIntroduce: true,
				collapseWhenDone: true,
				label: "Formula to replace "
			});
		} else {
			// We already have a result for the forwards application, render a plain text form place
			this.$("fieldset").append(this.bwdWffFormBlockView.render().$el);
		}

		this.$modalView.html(this.el);
		this.$modalView.modal({
			backdrop: "static",
			keyboard: false
		});

		return this;
	},

	successClose: function (e) {
		var direction = ($(e.target).hasClass("btn-info") ? -1 : 1),
			newWff = (direction < 0 ? this.model.get("bwdResult") : this.model.get("fwdResult"));

		e.stopPropagation();
		e.preventDefault();

		this.trigger("modalSuccess", {
			"newWff": newWff,
			"direction": direction,
			modal: this
		});
		this.close();
	},

	onSubFIntroSuccess: function (obj) {
		// Because the symbols must be unique to the side being added
		// Extract the symbol from obj.label
		var symbol = obj.label.substr(-1),
			direction = (this.model.get("bwdIntroSymbols").indexOf(symbol) < 0 ? 1 : -1),
			backwards = direction < 0,
			introSymbols = (backwards ? this.model.get("bwdIntroSymbols") : this.model.get("fwdIntroSymbols")),
			successSymbolIndex = introSymbols.indexOf(symbol),
			matchingPairs = (backwards ? this.model.get("bwdMatchingPairs") : this.model.get("fwdMatchingPairs")),
			formBlocks = (backwards ? this.bwdSubFIntroFormBlocks : this.fwdSubFIntroFormBlocks),
			result = (backwards ? "bwdResult" : "fwdResult"),
			h4Index = (backwards ? 1 : 0),
			wffFormBlockView = (backwards ? "bwdWffFormBlockView" : "fwdWffFormBlockView"),
			btn = (backwards ? this.$(".btn-info") : this.$(".btn-success"));

		// Add the [eqRule, subF] pair to the matchingPairs 
		matchingPairs.push([new App.Node({
			"symbol": symbol
		}), obj.newNode]);

		// Remove the successful symbol from the intro symbols array
		introSymbols.splice(successSymbolIndex, 1);

		// If there are no more subFs to be introduced for this direction
		if (introSymbols.length === 0) {
			// Set bwd/fwdResult
			this.model.set(result, this.model.get("eqRule").applyRule(direction, matchingPairs, this.model.get("node"), this.model.get("step").get("node")));

			// Create a block view containing this result
			this[wffFormBlockView] = new App.WffFormBlockView({
				model: new App.WffFormBlock({
					label: "Next Step",
					node: this.model.get(result).toString()
				})
			});

			// Close all the input forms
			_.each(formBlocks, function (fB) {
				fB.close();
			});

			// Add the WffFormBlockView to the Modal
			this.$("h4").eq(h4Index).after(this[wffFormBlockView].render().$el);

			// Enable the button and if it's the last input to disappear, close toolbar
			btn.removeAttr("disabled");
			if (this.$("input").length === 0) {
				this.closeToolbar();
			}
		}

	}
});


/* This is a modal for introducing a new Equivalence rule
	Supplied with nothing.
	lhsWff and rhsWff are set when successfully introduced.
		*/
App.NewEqRuleModal = Backbone.Model.extend({
	defaults: {
		labels: ["Right Hand Side", "Left Hand Side"]
	}
});


App.NewEqRuleModalView = App.ModalView.extend({
	template: _.template($("#newEqRuleModalTemplate").html()),

	events: {
		"blur input": "onTextBlur",
		"click .btn-success": "onAdd",
		"click .btn-close": "close",
		"click .close": "close"
	},

	initialize: function () {
		this.connectiveToolbar = new App.ConnectiveToolbarView();
		this.connectiveToolbar.bind("btnClicked", this.insertConnective, this);

		this.$lastFocus = false;
		this.lastPos = 0;

		this.$modalView = $("#newEqRuleModal");
		this.inputViews = [];

		this.equivalenceChecker = new App.EquivalenceChecker();
	},

	render: function () {
		var renderedContent = this.template({}),
			self = this;

		this.$el.html(renderedContent);

		// Create lhs and rhs inputs
		_.each(this.model.get("labels"), function (label, i) {
			var subFIntroFormBlock = new App.SubFIntroFormBlockView({
				model: new App.SubFIntroFormBlock({
					showIntroduce: false,
					collapseWhenDone: false,
					"label": label,
					"i": i,
					"value" : self.model.get(label) || "" // NewEqRuleModal can have "Right Hand Side" / "Left Hand Side" stuff that gets placed in text box automatically.
				})
			});

			// Add a reference to the input views to the modal
			self.inputViews.push(subFIntroFormBlock);

			self.$("fieldset").prepend(subFIntroFormBlock.render().$el);
			subFIntroFormBlock.bind("subFIntroSuccess", self.onSubFIntroSuccess, self);
		});

		// Add the connective toolbar
		this.$('fieldset').prepend(this.connectiveToolbar.render().$el);


		this.$modalView.html(this.el);
		this.$modalView.modal({
			backdrop: "static",
			keyboard: false
		});
		return this;
	},


	onAdd: function (e) {
		_.each(this.inputViews, function (input) {
			// Do general error checking
			input.onIntroduce();
		});

		// If we have a rhs wff and a lhs wff and there are no parser/user errors add the exercise
		if (this.model.get("lhsWff") !== undefined && this.model.get("rhsWff") !== undefined && this.$(".error").length === 0) {
			// Check the equivalence and if they're equivalent, add the exercise
			if (this.equivalenceChecker.testEquivalence(this.model.get("lhsWff"), this.model.get("rhsWff"))) {
				this.model.get("collection").add({
					category : "User Equivalences",
					lhsTrees : [this.model.get("lhsWff")],
					rhsTrees : [this.model.get("rhsWff")],
					bidirectional : this.$("[name=\"bidirectionalCheckbox\"]").prop("checked"),
					fromExercise : this.model.get("fromExercise")
				});
				this.close();
			} else {
				_.each(this.inputViews, function (input) {
					input.displayError("These two wffs are not equivalent.");
				});
			}
		}
	},

	// obj contains newNode - the tree from the textbox
	// and label - the label for the textbox
	onSubFIntroSuccess: function (obj) {
		// Update record of the wffs that have been successfully introduced
		if (obj.label[0] === "L") {
			this.model.set("lhsWff", obj.newNode);
		} else {
			this.model.set("rhsWff", obj.newNode);
		}
	}
});


/* This is a modal for writing the next step in a proof.
	Supplied with steps - a reference to the steps collection that should be added to.
		*/
App.WriteNextStepModal = Backbone.Model.extend({
	defaults: {
		result: false,
		eqRuleApplied: false
	},

	initialize: function () {
		this.set("lastStep", this.get("steps").last());
	}

});

App.WriteNextStepModalView = App.InExerciseModalView.extend({

	template: _.template($("#writeNextStepModalTemplate").html()),

	events: {
		"blur input": "onTextBlur",
		// Calls inherited close as there's no eq rule that needs to be deselected.
		"click .btn-close": "close",
		"click .close": "close",
		"click .btn-success": "onSuccessClick"
	},

	initialize: function () {
		this.$lastFocus = false;
		this.lastPos = 0;
		this.errors = 0;

		this.$modalView = $("#writeNextStepModal");

		this.connectiveToolbar = new App.ConnectiveToolbarView();
		this.connectiveToolbar.bind("btnClicked", this.insertConnective, this);

		this.inputView = new App.SubFIntroFormBlockView({
			model: new App.SubFIntroFormBlock({
				showIntroduce: true,
				collapseWhenDone: false,
				"label": "Next Step"
			})
		});

		this.inputView.bind("subFIntroSuccess", this.onSubFIntroSuccess, this);
	},

	render: function () {
		var renderedContent = this.template({
			lastStep: this.model.get("lastStep").get("node").toString()
		}),
			self = this;

		this.$el.html(renderedContent);
		this.$('.control-group').eq(0).after(this.connectiveToolbar.render().$el);

		this.$("fieldset").append(this.inputView.render().$el);
		this.inputView.bind("subFIntroSuccess", self.onSubFIntroSuccess, self);

		this.$modalView.html(this.el);
		this.$modalView.modal({
			backdrop: "static",
			keyboard: false
		});

		return this;
	},

	onSubFIntroSuccess: function (obj) {
		// There are no errors - test to see if the wff entered comes from the application of just one
		// equivalence rule, if it is then just display the new step that willbe added to the group and enable
		// the add button. Else display an error that says it is not the application of a rule.
		this.model.set("eqRuleApplied", App.EquivalenceRule.findEqRuleApplied(this.model.get("lastStep").get("node"), obj.newNode));

		// If no good rule was found, tell the user.
		if (this.model.get("eqRuleApplied") === false) {
			this.inputView.displayError("The above wff is not the result of an application of one equivalence rule.");
			return;
		}

		this.model.set("result", obj.newNode);

		this.closeToolbar();

		this.$("input").closest(".controls").html("<p class=\"bwdResult text-block\">" + obj.newNode.toString() + "&nbsp;<small>&nbsp;" + this.model.get("eqRuleApplied").rule.get("rule") + " " + (this.model.get("eqRuleApplied").direction > 0 ? "ltr" : "rtl") + "</small></p>");
		this.$(".btn-success").removeAttr("disabled");
	},

	onSuccessClick: function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.trigger("modalSuccess", {
			"newWff": this.model.get("result"),
			"direction": this.model.get("eqRuleApplied").direction,
			"eqRule": this.model.get("eqRuleApplied").rule,
			"steps": this.model.get("steps"),
			"step" : this.model.get("steps").last(),
			modal: this
		});
		this.close();
	}
});

/* This is a modal used when an eq rule is applicable in only one direction but
	requires the introduction of wff(s). Supplied with:
	Node node - The currently selected subF,
	Step step - The Step in which the currently selected subF resides,
	EquivalenceRule eqRule - The EqRule that is being applied,
	[] matchingPairs - An array of [eqRuleSymbol, subF] pairs that have been matched so far
	int direction : direction 1 = forwards, -1 backwards
		*/
App.WffIntroModal = Backbone.Model.extend({

	initialize: function () {
		this.set({
			introSymbols: (this.get("direction") > 0 ? this.get("eqRule").get("fwdIntroSymbols").slice(0) : this.get("eqRule").get("bwdIntroSymbols").slice(0))
		});
	}

});

App.WffIntroModalView = App.InExerciseModalView.extend({
	template: _.template($("#wffIntroModalTemplate").html()),

	events: {
		"blur input": "onTextBlur",
		"click .btn-close": "failClose",
		"click .close": "failClose",
		"click .btn-success": "wffIntroSuccessClose"
	},

	initialize: function () {
		this.$lastFocus = false;
		this.lastPos = 0;
		this.$modalView = $("#wffIntroModal");

		this.connectiveToolbar = new App.ConnectiveToolbarView();
		this.connectiveToolbar.bind("btnClicked", this.insertConnective, this);
		this.formBlocks = [];
	},

	render: function () {
		var renderedContent = this.template({
			rule: this.model.get("eqRule").get("rule"),
			node: this.model.get("node").toString(),
			direction: (this.model.get("direction") > 0 ? "ltr" : "rtl"),
			multipleSymbols: this.model.get("introSymbols").length > 1,
			introSymbolsCS: this.model.get("introSymbols").join(", ")
		}),
			self = this;

		this.$el.html(renderedContent);
		this.$('.control-group').eq(1).after(this.connectiveToolbar.render().$el);


		this.renderSubFIntroFormBlocks(this.model.get("introSymbols"), {
			showIntroduce: true,
			collapseWhenDone: true,
			label: "Formula for ",
			formBlocks: this.formBlocks
		});

		this.$modalView.html(this.el);
		this.$modalView.modal({
			backdrop: "static",
			keyboard: false
		});

		return this;
	},

	// obj contains newNode - the tree from the textbox
	// and label - the label for the textbox
	onSubFIntroSuccess: function (obj) {
		// Extract the symbol from obj.label
		// TODO: When predicate comes in Make more robust for multi-character variable names, for now just take last char
		var symbol = obj.label.substr(-1),
			successSymbolIndex = this.model.get("introSymbols").indexOf(symbol);

		// Add the [eqRule, subF] pair to the matchingPairs 
		this.model.get("matchingPairs").push([new App.Node({
			"symbol": symbol
		}), obj.newNode]);

		// Remove the symbol from introSymbols
		this.model.get("introSymbols").splice(successSymbolIndex, 1);

		// If there are no more subFs to be introduced...
		if (this.model.get("introSymbols").length === 0) {
			// Set the result
			this.model.set("result", this.model.get("eqRule").applyRule(this.model.get("direction"), this.model.get("matchingPairs"), this.model.get("node"), this.model.get("step").get("node")));

			// Create a block view containing this result
			this.wffFormBlockView = new App.WffFormBlockView({
				model: new App.WffFormBlock({
					label: "Next Step",
					node: this.model.get("result").toString()
				})
			});

			// Close all the input forms
			_.each(this.formBlocks, function (fB) {
				fB.close();
			});

			// Add the WffFormBlockView to the Modal
			this.$("fieldset").append(this.wffFormBlockView.render().$el);

			this.closeToolbar();
			this.$(".btn-success").removeAttr("disabled");
		}

	},

	wffIntroSuccessClose: function () {
		this.trigger("modalSuccess", {
			"newWff": this.model.get("result"),
			"direction": this.model.get("direction"),
			modal: this
		});
		this.close();
	}
});

/* The modal used for adding new exercises to the app */

App.NewExerciseView = App.ModalView.extend({
	template: _.template($("#newExerciseModalTemplate").html()),

	events: {
		"blur input": "onTextBlur",
		"click .btn-success": "onStart",
		"click .btn-close": "close",
		"click .close": "close"
	},

	initialize: function () {
		this.connectiveToolbar = new App.ConnectiveToolbarView();
		this.connectiveToolbar.bind("btnClicked", this.insertConnective, this);

		this.$lastFocus = false;
		this.lastPos = 0;

		this.$modalView = $("#newExerciseModal");
		this.labels = ["Starting Wff", "Finishing Wff"];
		this.inputViews = [];

		this.equivalenceChecker = new App.EquivalenceChecker();
	},

	render: function () {
		var renderedContent = this.template({}),
			self = this;

		this.$el.html(renderedContent);

		// Add the connective toolbar
		this.$('fieldset').prepend(this.connectiveToolbar.render().$el);

		// Create starting and finishing inputs
		_.each(this.labels, function (label, i) {
			var subFIntroFormBlock = new App.SubFIntroFormBlockView({
				model: new App.SubFIntroFormBlock({
					showIntroduce: false,
					collapseWhenDone: false,
					"label": label,
					"i": i
				})
			});

			// Add a reference to the input views to the modal
			self.inputViews.push(subFIntroFormBlock);

			self.$("fieldset").append(subFIntroFormBlock.render().$el);
			subFIntroFormBlock.bind("subFIntroSuccess", self.onSubFIntroSuccess, self);
		});

		this.$modalView.html(this.el);
		this.$modalView.modal({
			backdrop: "static",
			keyboard: false
		});
		return this;
	},


	onStart: function (e) {
		_.each(this.inputViews, function (input) {
			// Call the error checking function called by clicking introduce in wff intro modal
			input.onIntroduce();
		});

		// If we have a starting wff and a finishing wff and there are no parser/user errors add the exercise
		if (this.finishingWff !== undefined && this.startingWff !== undefined && this.$(".error").length === 0) {
			// Check the equivalence and if they're equivalent, add the exercise
			if (this.equivalenceChecker.testEquivalence(this.startingWff, this.finishingWff)) {
				App.exerciseManager.addNewExercise(this.startingWff, this.finishingWff);
				this.close();
			} else {
				_.each(this.inputViews, function (input) {
					input.displayError("These two wffs are not equivalent.");
				});
			}
		}
	},

	// obj contains newNode - the tree from the textbox
	// and label - the label for the textbox
	onSubFIntroSuccess: function (obj) {
		// Update record of the wffs that have been successfully introduced
		if (obj.label[0] === "F") {
			this.finishingWff = obj.newNode;
		} else {
			this.startingWff = obj.newNode;
		}
	}
});


/************* OBJECTS USED WITHIN MODALS **************/

/* This is just a form element that has a label and shows a wff rather than an input.
	Supplied with an obj containing :
	string label - label for the form block
	string node - the string representation of wff shown
*/
App.WffFormBlock = Backbone.Model.extend({});

App.WffFormBlockView = Backbone.View.extend({
	template: _.template($("#wffFormBlockTemplate").html()),
	className: "control-group",

	initialize: function () {
		// do nothing
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());
		this.$el.html(renderedContent);
		return this;
	}
});

/*  This is a form element that has a label and an wff input section that takes care of parsing the input.
	Supplied with an obj containing :
			bool showIntroduce - Whether or not the introduce button should be appended to input,
			bool collapseWhenDone - Whether or not the input should be replaced by text on successful input,
			string label - The label for the input box,
			int i : i - Integer representing the index of this subFIntroFormBlock within modal.
*/

App.SubFIntroFormBlock = Backbone.Model.extend({
	defaults: {
		error: false,
		i: 0,
		value : ""
	}
});

App.SubFIntroFormBlockView = Backbone.View.extend({

	events: {
		"click .introduce-wff": "onIntroduce"
	},

	template: _.template($("#subFIntroFormBlockTemplate").html()),
	className: "control-group",

	initialize: function () {
		// do nothing
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());
		this.$el.html(renderedContent);
		return this;
	},

	// When a wff is introduced, check to see if valid.
	// If not - display relevant errors.
	// If it is - replace the input with the new wff.
	onIntroduce: function (e) {

		// Cache the current values:
		var value = this.$("input").val(),
			newNode;

		this.removeError();

		// check value is not undefined needed when multiple introductions
		// but only one introduction button.
		if (value !== undefined && value.length > 0) {
			try {
				this.model.set({
					newNode: App.parser.parse(value)
				});
			} catch (error) {
				this.displayError(error.message, error.charPosition);
			}
		} else if (value !== undefined) { // If there is still an input and nothing in it
			this.displayError("Please enter a wff");
		}

		// If there are no errors, if collapsy - replace the form with the new subF
		// always inform the parent.
		if (value !== undefined && !this.model.get("error")) {
			if (this.model.get("collapseWhenDone")) {
				this.$(".controls").html("<p class=\"text-block\">" + this.model.get("newNode").toString() + "</p>");
			}

			this.trigger("subFIntroSuccess", {
				"newNode": this.model.get("newNode"),
				"label": this.model.get("label")
			});
		}
	},

	displayError: function (errorMessage, charPosition) {
		this.$el.addClass("error").find(".help-block").html(errorMessage);

		// Check to see if this is the first error
		if (this.$el.prevAll(".error").length === 0) {
			this.$("input").focus().setCursorPosition(charPosition - 1 || 0);
		}

		this.model.set({
			error: true
		});
	},

	removeError: function () {
		this.$el.removeClass("error").find(".help-block").empty();

		this.model.set({
			error: false
		});
	}
});

/*  This is a button collection that triggers a "btnClicked" event and
	sends through the character of the symbol clicked on.
	Supplied with nothing.
*/

App.ConnectiveToolbarView = Backbone.View.extend({
	tagName: "div",
	className: "control-group",
	template: _.template($("#connectiveToolbarTemplate").html()),

	events: {
		"click .btn": "btnClicked"
	},

	initialize: function () {
		//do nothing
	},

	render: function () {
		var renderedContent = this.template({});
		this.$el.html(renderedContent);
		return this;
	},

	btnClicked: function (e) {
		e.preventDefault();
		e.stopPropagation();
		this.trigger("btnClicked", $(e.target).text());
	}
});

/* This is used within modal dialogs to chec whether two formulae are equivalent or not */

App.EquivalenceChecker = Backbone.Model.extend({

	testEquivalence: function (node, node2) {
		var atoms = [],
			equivNode = new App.DimplyNode({
				left: node,
				right: node2
			}),
			i, noWffs = 0,
			truthTableRows = 0,
			truthValues;

		equivNode.getAtoms(atoms);
		noWffs = atoms.length;
		truthTableRows = Math.pow(2, noWffs);

		// should create a truth table full of true values if node and node2 are equivalent
		for (i = 0; i < truthTableRows; i++) {
			truthValues = this.createBinary(i, noWffs);
			this.assignTruthValues(truthValues, atoms);
			if (!equivNode.truthValue()) {
				return false;
			}
		}
		return true;
	},

	// takes a number, i, and returns a string of length len that represents that number in binary
	// if len < the length of i in binary, it is ignored
	createBinary: function (i, len) {
		var binary = i.toString(2),
			padding = [],
			padNeeded = len - binary.length;

		while (padNeeded > 0) {
			padding.push(0);
			padNeeded--;
		}

		return padding.join("") + binary;
	},

	assignTruthValues: function (tvals, nodeArray) {
		_.each(nodeArray, function (elem, i) {
			_.each(elem.objects, function (atom) {
				if (tvals[i] === "1") {
					atom.set({
						"truth": true
					});
				} else {
					atom.set({
						"truth": false
					});
				}
			});
		});
	}
});

/* User registration modal dialog */

App.UserRegistrationView = Backbone.View.extend({
	events : {
		"click .btn-close": "removeValsAndErrors",
		"click .close": "removeValsAndErrors",
		"focus #registerPassword" : "showPasswordConfirm",
		"blur #registerUsername" : "checkUsername",
		"click #registerUserAvailBtn" : "checkUsername",
		"click .btn-primary" : "onRegisterClick"
	},

	initialize : function () {
		// Cache the a jQuery ref to the divs containing the inputs
		this.$username = this.$(".control-group").eq(0);
		this.$password = this.$(".control-group").eq(1);
		this.$passwordConf = this.$(".control-group").eq(2);

		this.ajaxPending = false;
		this.registerIsWaiting = false;
	},

	render : function () {
		this.$el.modal({
			backdrop: "static",
			keyboard: false
		});

		// In case the modal has already been shown
		this.hidePasswordConfirm();
		return this;
	},

	checkUsername : function () {
		var self = this,
			username = this.$("#registerUsername").val();
		
		this.removeMsg(this.$username);

		if (username.length >0) { // Check that the username isn't already taken
			this.ajaxPending = true;
			$.get('api/usernameTaken/' + username , function(data) {
				self.ajaxPending = false;
				if (data.error) { // Either DB conn error/username taken
					if (self.registerIsWaiting) {
						$(".btn-primary").removeAttr("disabled"); // re-enable the register button.
					}
					self.displayMsg(self.$username, true, data.error);
				} else {
					if (self.registerIsWaiting) { // Then the register button had been clicked between request response.
						self.addUserToDb();
					} else {
						self.displayMsg(self.$username, false,"This username is available.");
					}
				}
			}, "json");
		} else { // The field is empty, prompt for input
			this.displayMsg(this.$username, true, "Please enter a username.");
		}
	},

	checkPassword : function () {
		var passVal = this.$("#registerPassword").val();

		this.removeMsg(this.$password);
		
		if (passVal.length === 0) {
			this.displayMsg(this.$password, true, "Please enter a password");
		}
	},

	checkPasswords : function () {
		var passVal = this.$("#registerPassword").val(),
			passConfVal = this.$("#registerPasswordConf").val(),
			$bothPasswords = this.$password.add(this.$passwordConf);

		this.removeMsg($bothPasswords);

		if (passVal.length === 0) {
			this.displayMsg(this.$password, true, "Please enter a password");
		} else if (passConfVal.length === 0) {
			this.displayMsg(this.$passwordConf, true, "Please confirm your password");
		} else if (passVal !== passConfVal) {
			this.displayMsg($bothPasswords, true, "The passwords are not the same");
		}	
	},

	showPasswordConfirm : function () {
		this.$passwordConf.slideDown().removeClass("hide");
	},

	hidePasswordConfirm : function () {
		this.$passwordConf.hide();
	},

	removeValsAndErrors : function () {
		this.$("input").val(""); // Remove all the values from the inputs
		this.removeMsg($(".control-group")); // Remove all errors
		this.$("span").remove(); // Remove the message to tell the user we're waiting on the db
		this.$(".btn-primary").removeAttr("disabled"); // Re-enable the register button.
	},

	onRegisterClick : function (e) {
		e.stopPropagation();
		e.preventDefault();

		this.checkPasswords();
		
		if (!this.$username.hasClass("success") && !this.$username.hasClass("error")) { // Then the username hasn't been checked
			this.checkUsername();
		} else if (this.ajaxPending) { // Then we are currently waiting to find out if the username is available.
			$(e.target).attr("disabled", "disabled"); // disable the register button.
			this.registerIsWaiting = true; 
			if (this.$(".modal-footer").find("span").length === 0) { // If there isn't a sign to tell the user to wait then make one
				this.$(".modal-footer").prepend("<span class=\"pull-left\">Please wait while we check if the username is available.</span>");
			}
		} else if (this.$(".error").length === 0) { // Then the username and password are fine, proceed.
			$(e.target).attr("disabled", "disabled");  // Disable the register button.
			this.addUserToDb();
		}
	},

	addUserToDb : function () {

		var self = this;
		// Do a little clean up.
		this.registerIsWaiting = false;

		$.ajax({	
			url : 'api/addUsername',
			type : "POST",

			data : JSON.stringify({
				"username" : this.$("#registerUsername").val(),
				"password" : this.$("#registerPassword").val()
			}),

			contentType : "application/json",

			dataType : "json",

			processData : false,

			success : function (data) {
				var username = self.$("#registerUsername").val();

				if (data.error) {
					// Display an error to the user to tell them that it failed.
					self.$(".modal-footer").prepend("<span class=\"pull-left\">" + data.error + "</span>");
					self.$(".btn-primary").removeAttr("disabled"); // Re-enable the register button.
				} else {
					// The user has been added to the database.
					self.removeValsAndErrors();
					// Log the user in
					App.vent.trigger("userRegistered", username); // The UserManager is bound to this event. It basically signs them in.
					self.$el.modal("hide");
				}
			},

			failure : function (data) {
				// Display an error to the user to tell user it failed.
				self.$(".modal-footer").prepend("<span class=\"pull-left\">UH OH! We hit a problem. Please try again later.</span>");
				self.$(".btn-primary").removeAttr("disabled"); // Re-enable the register button.
			}
		});
	},

	displayMsg : function ($inputGroup, isError, msg) {
		$inputGroup.addClass((isError ? "error" : "success")).find("p").text(msg);
	},

	removeMsg : function ($inputGroup) {
		$inputGroup.removeClass("error success").find("p").text("")
	}
});

App.userRegistrationView = new App.UserRegistrationView({
	el: document.getElementById("newUserModal")
});