var App = App || {};

// Each Step holds any type of node
App.Step = Backbone.Model.extend({
	toJSON : function () {
		var json = _.clone(this.attributes);
		json.node = json.node.toString();
		return json;
	},

	// An override of the normal Backbone model clone used when saving a completed
	// Step - needed to create a copy of the tree
	clone : function () {
		var attrs = _.clone(this.attributes);
		attrs.node = attrs.node.deepClone();
		return new this.constructor(attrs);
	}
});

// Each Step is represented as a list item in HTML, acts as a container for the
// mess of spans created by rendering the AnswerNodeViews
App.StepView = Backbone.View.extend({
	tagName: "li",
	className: "answerStep",
	template: _.template($("#answerStepTemplate").html()),

	// Set the id of the list item element to the model's cid, this allows for
	// a reference to the containing step to be retreived when a node is clicked
	// on - just by looking at the id of its containing list item and using 
	// getByCid() to retrieve it from the collection.

	attributes : function () {
		return {
			id: this.model.cid
		};
	},

	initialize: function () {
		this.nodeView = new App.AnswerNodeView({ model: this.model.get("node") });

		this.model.on("change:from", this.onChangeFrom, this);
		this.model.on("change:no", this.onChangeNo, this);
		this.model.on("change:unused", this.onChangeUnused, this);

		// Used for determining whether to display in roman numerals or not
		// i.e working backwards will display in roman numerals
		this.backwards = this.options.backwards;
	},

	render: function () {
		var renderedContent = this.template({ 
				rule : this.model.get("rule"),
				no : (!this.backwards ? this.model.get("no") : App.toRomanNumerals(this.model.get("no"))),
				from : (!this.backwards && this.model.get("from") ? this.model.get("from") : App.toRomanNumerals(this.model.get("from")))
			});

		this.$el.html(renderedContent);
		this.$("span.stepNo").after(this.nodeView.deepRender().$el);
		return this; // seems unness but conventional
	},

	onChangeFrom : function () {
		this.$("span.stepFrom").text(" (" + this.model.get("from") + ")");
	},

	onChangeNo : function () {
		this.$("span.stepNo").text(this.model.get("no") + ") ");
	},

	onChangeUnused : function () {
		if (this.model.get("unused")) {
			this.$el.addClass("strikethrough");
		}
	}
});

// A collection of steps - needed for both the input and goal sets.
App.Steps = Backbone.Collection.extend({
	model: App.Step,

	initialize: function () {
		// do nothing
	},

	// A check to see if this is the input/goal steps
	isInputSteps: function () {
		// Check if the rule is Start Wff
		return "S" === this.at(0).get("rule")[0];
	},

	getStepsString : function () {
		if (this.isInputSteps()) {
			return "inputSet";
		}
		return "goalSet";
	},

	renumberSteps : function () {
		var i, noSteps;

		for (i = 1, noSteps = this.length; i < noSteps; i++) {
			this.at(i).set({
				no : i + 1,
				from : i
			});
		}
	},

	showUnusedSteps : function (idx) {
		var usedSteps,
			i,
			noSteps;

		usedSteps = this.findAncestorSteps(idx);

		// Delete all the steps that weren't used in the proof
		for (i = this.length - 1; i > 0; i--) {
			if (usedSteps.indexOf(i) < 0) { // Then this index hasn't been used in the proof
				this.at(i).set({ unused: true });
			}
		}
	},

	// Finds all the steps that the step at idx relies upon
	findAncestorSteps : function (idx) {
		var steps = [],
			idxCameFrom;

		// Get the indices of all the steps used
		idxCameFrom = this.at(idx).get("from");

		if (idxCameFrom != null) {
			steps.push(this.length - 1);
		}

		while (idxCameFrom !== null) {
			steps.push(idxCameFrom - 1) // Need to go back to 0 index
			idxCameFrom = this.at(idxCameFrom - 1).get("from"); // Get the step that this step came from.
		}

		return steps;
	},

	// Finds all the steps that rely upon the step at idx
	findChildSteps : function (idx) {
		var steps = [idx], // include the idx in the list of child steps
			nextIdx;

		// Find all the steps that rely upon this one
		this




	}
});

App.StepsView = Backbone.View.extend({
	tagName: "section",
	className: "answerSection",
	template: _.template($("#stepSetTemplate").html()),

	initialize: function () {
		this.collection.on("reset", this.render, this);
		this.collection.on("add", this.render, this);
		this.collection.on("remove", this.render, this);

		// Used for determining whether to app/pre-pend the steps
		// i.e working backwards from the goal will stack upwards,
		// working forwards from the input will stack downwards.
		this.backwards = this.options.backwards;

		this.stepViewModelPairs = [];
	},

	render: function () {
		var self = this;

		// Render the StepsView container, passing nothing as it just contains
		// and empty ul.
		this.$el.html(this.template({}));

		this.collection.each(function (step) {
			self.addNewStepView(step);
		});

		return this;
	},

	onAdd : function (step) {
		this.addNewStepView(step);
	},

	onRemove : function (eqRule) {
		// Find the view, eqRule pair that holds the eqRule being deleted.
		var pairToRemove = _.find(this.stepViewModelPairs, function (pair) {
			return pair[1] === eqRule;
		});

		// Remove the view from the DOM
		pairToRemove[0].remove();

		// Remove the [view, step] pair from the array 
		this.stepViewModelPairs = _.without(this.stepViewModelPairs, pairToRemove);
	},

	addNewStepView : function (step) {
		var view = new App.StepView({
				model: step,
				collection: this.collection,
				backwards : this.backwards
			});

		// Bind all the nodes 
		view.nodeView.bindAll("symbolEnterToStep", this.onSymbolEnter, this);
		view.nodeView.bindAll("symbolLeaveToStep", this.onSymbolLeave, this);
		view.nodeView.bindAll("symbolClickToStep", this.onSymbolClick, this);

		if (this.backwards) {
			// Stack upwards
			this.$(".stepSet").prepend(view.render().$el);
		} else {
			// Stack downwards
			this.$(".stepSet").append(view.render().$el);
		}

		this.stepViewModelPairs.push([view, step]);
	},

	getStepFromNode: function (nodeView) {
		// This returns the Step that contains the nodeView passed as the parameter
		// This relies on each step's list item having its cid as it's id attribute
		var stepCid = nodeView.$el.closest("li").attr("id");
		return this.collection.getByCid(stepCid);
	},

	onSymbolEnter: function (nodeView) {
		nodeView.$el.addClass("highlighted");
	},

	onSymbolLeave: function (nodeView) {
		// If this the node isn't been selected, then remove the highlight
		if (!nodeView.model.get("selected")) {
			nodeView.$el.removeClass("highlighted");
		}
	},

	onSymbolClick: function (nodeView) {
		// Get the step that contains this nodeView
		var step = this.getStepFromNode(nodeView);
		// Trigger the symbol click event, giving node, step and steps
		this.trigger("symbolClick", nodeView, step, this.collection);
	}
});

/****** TYPE USED BY EXERCISE VIEW *****/

// An Alert holds the data that should be displayed within a bootstrap alert-block
App.Alert = Backbone.Model.extend({
	defaults: {
		heading: "Warning",
		body: "Default warning",
		delay: false,
		closable: true
	}
});

// Creates an alert-block div with an Alert to give it the data to show.
App.AlertView = Backbone.View.extend({

	template: _.template($("#alertTemplate").html()),
	tagName: "div",

	attributes: function () {
		return {
			"class": "alert alert-block fade in " + this.model.get("type")
		};
	},

	initialize: function () {
		// The alert can optionally be created with a delay option in ms
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON()),
			self = this;

		this.$el.html(renderedContent);

		// If the alert is set to disappear, make it happen
		if (this.model.get("delay")) {
			setTimeout(function () {
				self.$el.alert("close");
			}, this.model.get("delay"));
		}
		return this;
	}
});

/***** END OF TYPE USED BY EXERCISE VIEW *****/

// Holds 2 Steps collections
App.Exercise = Backbone.Model.extend({
	url : "api/exercise",

	// MongoDB's idAttribute is _id
	idAttribute: "_id",

	defaults: {
		current : false,
		currentlySelectedNode : null,
		currentlySelectedStep : null,
		currentlySelectedEqRule : null,
		currentlySelectedSteps : null,
		undoAvailable : false,
		unstackAvailable : false,
		completed : false,
		completedInputSet : null,
		completedGoalSet : null
	},

	initialize: function () {
		// Only when currently selected stuff changes should the function be called
		// Have defined custom event changeCurrentlySelectedNodeEtc - stops event from firing three times 
		// when node/step/steps is updated - cannot use global change event as this includes other attrs.
		this.on("change:currentlySelectedEqRule changeCurrentlySelectedNodeEtc", this.onChangeSelections, this);

		if (this.get("exerciseString") === undefined && this.get("undoArray") === undefined) {
			this.set({
				// The equivalence that is to be proved with an equivalence sign in the middle
				exerciseString : this.get("inputSet").at(0).get("node").toString() + " \u2261 " + this.get("goalSet").at(0).get("node").toString(),
				// An array that holds references to the steps that were added to - in order to allow for undoing
				undoArray : []
			});
		}
	},

	onChangeSelections: function () {
		// output for debugging
		// TODO: remove this for production
		if (this.get("currentlySelectedNode")) { console.log("Current Node: ", this.get("currentlySelectedNode").toString()); }
		if (this.get("currentlySelectedStep")) { console.log("Current Step: ", this.get("currentlySelectedStep").get("node").toString()); }
		if (this.get("currentlySelectedSteps")) { console.log("Current Steps: ", this.get("currentlySelectedSteps")); }
		if (this.get("currentlySelectedEqRule")) { console.log("Current EqRule: ", this.get("currentlySelectedEqRule").get("rule")); }

		// If a whole step is selected and it is not the input or the goal then trigger the allowance of unstacking
		if (this.get("currentlySelectedNode") && this.get("currentlySelectedStep")
				&& this.get("currentlySelectedNode").toString() === this.get("currentlySelectedStep").get("node").toString()
				&& this.get("currentlySelectedStep") !== this.get("currentlySelectedSteps").at(0)) {
			this.set({ unstackAvailable: true });
		} else {
			// Unstacking should not be available
			this.set({ unstackAvailable: false });
		}

		// If we have selected both a node and an equivalence rule, try to apply the rule to the node
		if (this.get("currentlySelectedNode") && this.get("currentlySelectedEqRule")
				&& this.get("currentlySelectedStep") && this.get("currentlySelectedSteps")) {
			this.applyEqRuleToNode();
		}
	},

	// Deselect both the active equivalence rule and node
	deselectEqRuleAndNode: function () {
		this.deselectNode();
		this.deselectEqRule();
	},

	// Deselects the currently active equivalence rule
	deselectEqRule: function () {
		// Set the currently selected rules active property to false
		if (this.get("currentlySelectedEqRule")) {
			this.get("currentlySelectedEqRule").set({ active: false });
		}
		// Set the Exercise's record of selected eq rule to false
		this.set({ currentlySelectedEqRule : null });
	},

	// Deselects the currently active Node
	deselectNode: function () {
		// Set the currently selected rules active property to false
		if (this.get("currentlySelectedNode")) {
			this.get("currentlySelectedNode").set({ selected: false });
		}
		// Set the Exercise's record of selected node to false
		this.set({
			currentlySelectedNode: null,
			currentlySelectedStep: null,
			currentlySelectedSteps: null
		});
		this.trigger("changeCurrentlySelectedNodeEtc");
	},

	getOppositeSet: function (set) {
		if (set === this.get("inputSet")) {
			return this.get("goalSet");
		}
		return this.get("inputSet");
	},

	applyEqRuleToNode: function () {
		// Cache the variables:
		var node = this.get("currentlySelectedNode"),
			step = this.get("currentlySelectedStep"),
			steps = this.get("currentlySelectedSteps"),
			eqRule = this.get("currentlySelectedEqRule"),
			eqResult,
			newWff,
			modalView,
			introSymbols = [],
			bwdMatchingPairs = eqRule.isApplicable(-1, node),
			fwdMatchingPairs = eqRule.isApplicable(1, node);

		if (eqRule.get("bidirectional") && bwdMatchingPairs && fwdMatchingPairs) {
			// If both ways is applicable, need to ask which to apply
			modalView = new App.EqRuleDirChooseModalView({
				model : new App.EqRuleDirChooseModal({
					"node" : node,
					"step" : step,
					"eqRule" : eqRule,
					"bwdMatchingPairs" : bwdMatchingPairs,
					"fwdMatchingPairs" : fwdMatchingPairs
				})
			});
			// Bind events in the modal dialog to functions in this context so that the correct
			// action can be taken.
			modalView.bind("modalSuccess", this.onModalSuccess, this);
			modalView.bind("modalChooseFail", this.onModalChooseFail, this);
			// Display the modal dialog
			modalView.render();
		} else if (eqRule.get("bidirectional") && bwdMatchingPairs) {
			// If backwards application requires formula introduction
			if (eqRule.get("bwdIntroSymbols").length > 0) {
				// Ask user what formulas should be introduced
				this.createWffIntroModalView(node, step, eqRule, bwdMatchingPairs, -1);
			} else {
				this.applyRuleAndAddStep(eqRule, -1, bwdMatchingPairs, node, step, steps);
			}
		} else if (fwdMatchingPairs) {
			// If forwards application requires formula introduction
			if (eqRule.get("fwdIntroSymbols").length > 0) {
				// Ask user what formulas should be introduced
				this.createWffIntroModalView(node, step, eqRule, fwdMatchingPairs, 1);
			} else {
				this.applyRuleAndAddStep(eqRule, 1, fwdMatchingPairs, node, step, steps);
			}
		} else { // The rule is not applicable deselect the equivalence rule.
			this.deselectEqRule();
			// Trigger event in ExerciseView to tell the user to try again with another rule. 
			this.trigger("alertEqRuleNotApplicable");
		}
	},

	checkIfCompleted: function () {
		var lastStepsStepPair = _.last(this.get("undoArray")),
			lastAddedSteps = this.get(lastStepsStepPair[0]),
			lastAddedStep = lastAddedSteps.at(lastStepsStepPair[1]),
			oppositeSet = this.getOppositeSet(lastAddedSteps),
			lastAddedStepString = lastAddedStep.get("node").toString(),
			idxOfMatchingStep = -1,
			lastStepFrom,
			usedSteps = [],
			self = this;

		oppositeSet.each(function (step, idx) { // Go through each of the steps in opposite set
			if (step.get("node").toString() === lastAddedStepString) {
				idxOfMatchingStep = idx;
				lastAddedSteps.showUnusedSteps(lastAddedSteps.length - 1);
				oppositeSet.showUnusedSteps(idxOfMatchingStep);
				self.saveCompletedVersion();
				self.set({ 
					completed : true,
					undoAvailable : false
				});
			}
		});
	},

	saveCompletedVersion : function () {
		var stepPairs = [["inputSet", "completedInputSet"], ["goalSet", "completedGoalSet"]],
			self = this;

		_.each(stepPairs, function (stepPair) {
			var normalSteps = self.get(stepPair[0]),
				completedSteps = stepPair[1],
				usedSteps = normalSteps.filter(function (step) { return !step.get("unused"); });

			// Set the completed steps to be a copy of those steps that were used
			self.set(completedSteps, new App.Steps(_.map(usedSteps, function(step) { return step.clone(); })));
			// Renumber the steps to account for unused steps
			self.get(completedSteps).renumberSteps();
		});
	},

	// Adds a new step to steps, with newWff as it's node and the rule text and direction it was used in
	addNewStep : function (newWff, steps, rule, direction, fromStep) {
		var newStep = new App.Step({
				node: newWff,
				rule: rule.get("rule") + " " + (direction > 0 ? "ltr" : "rtl"),
				no : steps.length + 1,
				from : fromStep.get("no"),
				unused : false
			});

		// Add the new step to the steps collection
		steps.add(newStep);
		// Add a [stepsString, stepPos] pair to the undoArray
		this.addToUndo(steps);
	},

	createWffIntroModalView : function (node, step, eqRule, matchingPairs, direction) {
		var modalView = new App.WffIntroModalView({
			model: new App.WffIntroModal({
				"node" : node,
				"step" : step,
				"eqRule" : eqRule,
				"matchingPairs" : matchingPairs,
				"direction" : direction
			})
		});

		// Bind the modal events to events in this context.
		modalView.bind("modalSuccess", this.onModalSuccess, this);
		modalView.bind("modalChooseFail", this.onModalChooseFail, this);
		modalView.render();
	},

	// obj contains newWff, direction and if from WriteNextStepModal - step, steps, eqRule

	onModalSuccess : function (obj) {
		this.addNewStep(obj.newWff, obj.steps || this.get("currentlySelectedSteps"), obj.eqRule || this.get("currentlySelectedEqRule"), obj.direction, obj.step || this.get("currentlySelectedStep"));
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
		obj.modal.unbind("modalChooseFail", this.onModalChooseFail);
		obj.modal.unbind("modalSuccess", this.onModalSuccess);
	},

	onModalChooseFail : function (obj) {
		// The user closed the modal dialog so it may be they made a mistake
		// so, deselect the chosen equivalence rule
		this.deselectEqRule();
		obj.modal.unbind("modalChooseFail", this.onModalChooseFail);
		obj.modal.unbind("modalSuccess", this.onModalSuccess);
	},

	applyRuleAndAddStep : function (eqRule, direction, matchingPairs, node, step, steps) {
		// Apply the selected rule fwd, given the matching pairs, selected subF and whole formula
		var newWff = eqRule.applyRule(direction, matchingPairs, node, step.get("node"));
			
		// Add the resulting step to the currently selected steps.
		this.addNewStep(newWff, steps, eqRule, direction, step);
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
	},

	addToUndo : function (steps) {
		// Add a [stepsString, stepPos] pair to the undoArray
		this.get("undoArray").push([steps.getStepsString(), steps.length - 1]);
		if (this.get("undoArray").length === 1) { this.set({ undoAvailable : true }); }
	},

	undo : function () {
		var undoArray = this.get("undoArray"),
			lastPair,
			stepsString,
			steps,
			stepPos;
		
		if (this.get("undoAvailable")) {
			// Pop off the reference to the last [stepsString, stepPos] pair added.
			lastPair = undoArray.pop();
			stepsString = lastPair[0];
			stepPos = lastPair[1];
			steps = this.get(stepsString);

			// Removes the last Step from thoses Steps
			steps.remove(steps.at(stepPos));
			
			// If there is nothing else in the undoArray disable the undo feature.
			if (undoArray.length === 0) { this.set({ undoAvailable : false }); }
			this.deselectEqRuleAndNode();
		}
	},

	// TODO: make this delete the resulting wffs as well
	unstack : function () {
		var lastUndoPos = -1,
			undoArray = this.get("undoArray");
		if (this.get("unstackAvailable")) {
			// Removes the top step from the currently selected step
			this.get("currentlySelectedSteps").pop();
			// Need to remove the last reference to this currentlySelectedStep from the undoArray
			lastUndoPos = _.lastIndexOf(undoArray, this.get("currentlySelectedSteps"));
			if (lastUndoPos !== -1) {
				// Remove the element
				undoArray.splice(lastUndoPos, 1);
				// If there is nothing else in the undoArray disable the undo feature.
				if (undoArray.length === 0) { this.set({ undoAvailable : false }); }
			}
			this.deselectEqRuleAndNode();
		}
	},

	toJSON : function () {
		var json = _.clone(this.attributes);
		json.goalSet = json.goalSet.toJSON();
		json.inputSet = json.inputSet.toJSON();
		json.currentlySelectedSteps = null;
		json.currentlySelectedStep = null;
		json.currentlySelectedNode = null;
		json.currentlySelectedEqRule = null;
		return json;
	},

	parse : function (response) {
		return App.Exercise.parse(response);
	}
}, {

	parse : function (exJSON) {
		exJSON.inputSet = new App.Steps(
			_.map(exJSON.inputSet, function (step) {
				step.node = App.parser.parse(step.node);
				return new App.Step(step);
			})
		);

		exJSON.goalSet = new App.Steps(
			_.map(exJSON.goalSet, function (step) {
				step.node = App.parser.parse(step.node);
				return new App.Step(step);
			})
		);

		return exJSON;
	}
});

// Holds the two steps collection views
App.ExerciseView = Backbone.View.extend({

	template : _.template($("#exerciseTemplate").html()),

	events : {
		"click .btn-undo" : "onUndoClick",
		"click .btn-unstack" : "onUnstackClick",
		"click .inputSetWrite" : "onInputSetWrite",
		"click .goalSetWrite" : "onGoalSetWrite"
	},

	initialize: function () {
		// Create the input set and goal set and bind to the symbolclick event triggered by the NodeView 
		// and in turn the StepsView after getting info on which node, step and collection the node belongs
		// to.
		this.inputSetView = new App.StepsView({ collection: this.model.get("inputSet"), backwards: false });
		this.goalSetView = new App.StepsView({ collection: this.model.get("goalSet"), backwards: true });
		this.inputSetView.on("symbolClick", this.onNodeSelected, this);
		this.goalSetView.on("symbolClick", this.onNodeSelected, this);

		// Bind to the event the Exercise triggers when the user tries to apply an eq rule
		// that isn't applicable to the selected node.
		this.model.on("alertEqRuleNotApplicable", this.onEqRuleNotApplicable, this);

		// Bind to the Exercise's completed member changing.
		this.model.on("change:completed", this.onChangeCompleted, this);

		// Bind to the Exercise's undo and unstack availablity members changing.
		this.model.on("change:undoAvailable", this.onChangeUndoAvailable, this);
		this.model.on("change:unstackAvailable", this.onChangeUnstackAvailable, this);

	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());

		// Bind to centralised hub event that is triggered by the EquivalenceRuleView that has been
		// clicked on to select a certain eq rule.
		App.vent.bind("currentlySelectedEqRuleChange", this.onEqRuleSelected, this);

		this.$el.html(renderedContent);
		// Render the input set
		this.$el.append(this.inputSetView.render().$el);
		// Add a button to input a new wff to the input set - this will get replaced by a
		// input box when the button is pressed.
		this.$el.append("<div class=\"writeBtns\"></div>");
		this.$(".writeBtns")
			.append("<div class=\"inputSetWrite\"><i class=\"icon-edit\"></i> <span>Write next step</span></div>")
			.append("<div class=\"goalSetWrite\"><i class=\"icon-edit\"></i> <span>Write next step</span></div>");

		this.$el.append(this.goalSetView.render().$el);
		// renders a exercise complete message if you are coming back to a completed exercise
		this.onChangeCompleted();
		return this;
	},

	onNodeSelected: function (nodeView, step, steps) {
		if (!this.model.get("completed")) {
			// Only let the user click on a node if the exercise hasn't been completed.
			if (!nodeView.model.get("selected")) {
				// If the node clicked on isn't the one that's currently selected.

				// If there is a node selected, deselect it.
				if (this.model.get("currentlySelectedNode")) {
					this.model.deselectNode();
				}

				// Set this node to selected and keep a records of currently selected in the 
				// Exercise

				nodeView.model.set({ selected: true });
				this.model.set({
					currentlySelectedNode: nodeView.model,
					currentlySelectedStep: step,
					currentlySelectedSteps: steps
				});

				this.model.trigger("changeCurrentlySelectedNodeEtc");
			} else {
				// The node was previously selected and has been clicked so deselect it!
				// Update the node and the record in the Exercise.
				this.model.deselectNode();
			}
		}
	},

	onEqRuleSelected: function (eqRule) {
		if (!eqRule.get("active")) {
			// If the eq rule isn't currently selected

			// If there is already a selected eq rule, deselect it
			if (this.model.get("currentlySelectedEqRule")) {
				this.model.get("currentlySelectedEqRule").set({
					active: false
				});
			}

			// Set the equivalence rule to active and update the exercise's reference
			eqRule.set({ active: true });
			this.model.set({ currentlySelectedEqRule: eqRule });

		} else {
			// The eq node was previously selected and has been clicked to be deselected
			eqRule.set({ active: false });
			this.model.set({ currentlySelectedEqRule: false});
		}
	},

	onEqRuleNotApplicable: function () {

		// Create an alert view to inform the user of the problem
		var newAlertView = new App.AlertView({
				model : new App.Alert({
					heading: "Not Applicable",
					body: "Unfortunately the equivalence rule you selected is not applicable to the selected sub-formula. Please try another.",
					type: "", // normal yellow
					closable: true,
					delay: 4000
				})
			});

		// Place the alert inbetween the 2 answer sections (input set and goal set)
		this.$(".answerSection").eq(0).after(newAlertView.render().$el);
	},

	onChangeCompleted: function () {
		if (this.model.get("completed")) {
			// Create an alert view to inform the user they've completed
			var successAlertView = new App.AlertView({
					model : new App.Alert({
						heading: "Exercise Complete",
						body: "You have successfully completed the exercise",
						type: "alert-success", // green for success
						closable: false,
						delay: false
					})
				});

			// Place the alert inbetween the 2 answer sections (input set and goal set)
			this.$(".answerSection").eq(0).after(successAlertView.render().$el);
			this.$('.writeBtns').addClass("hide");
		} else {
			this.$(".alert-success").remove();
			this.$('.writeBtns').removeClass("hide");
		}
	},

	onChangeUndoAvailable: function () {
		if (this.model.get("undoAvailable")) {
			this.$(".btn-undo").removeAttr("disabled");
		} else {
			this.$(".btn-undo").attr("disabled", true);
		}
	},

	onUndoClick : function () {
		this.model.undo();
	},

	onChangeUnstackAvailable: function () {
		if (this.model.get("unstackAvailable")) {
			this.$(".btn-unstack").removeAttr("disabled");
		} else {
			this.$(".btn-unstack").attr("disabled", true);
		}
	},

	onUnstackClick : function () {
		this.model.unstack();
	},

	createWriteNextStepModalView : function (set) {
		var writeNextStepModal = new App.WriteNextStepModalView({
				model : new App.WriteNextStepModal({
					steps : this.model.get(set)
				})
			});

		writeNextStepModal.bind("modalSuccess", this.model.onModalSuccess, this.model);
		writeNextStepModal.render();
	},

	onInputSetWrite : function () {
		this.model.deselectEqRuleAndNode();
		this.createWriteNextStepModalView("inputSet");
	},

	onGoalSetWrite : function () {
		this.model.deselectEqRuleAndNode();
		this.createWriteNextStepModalView("goalSet");
	},

	onClose : function () {
		// Unbind from centralised hub event so that only the one currently displayed receives this update
		App.vent.unbind("currentlySelectedEqRuleChange", this.onEqRuleSelected);
	}

});

App.Exercises = Backbone.Collection.extend({
	model : App.Exercise,
});

App.ExerciseListItemView = Backbone.View.extend({

	events : {
		"click *" : "onClick"
	},

	tagName: "li",
	className: "exerciseListItem",
	template: _.template($("#exerciseListItemTemplate").html()),

	initialize: function () {
		this.model.on("change:current", this.onCurrentChange, this);
	},

	render: function () {
		var renderedContent = this.template({
			"exercise" : this.model.get("exerciseString")
		});

		this.$el.html(renderedContent);
		if (this.model.get("current")) {
			this.$el.addClass("active");
		}

		return this;
	},

	onCurrentChange : function () {
		if (this.model.get("current")) {
			this.$el.addClass("active");
		} else {
			this.$el.removeClass("active");
		}
	},

	onClick : function (e) {
		e.preventDefault();
		e.stopPropagation();
		this.trigger("exClicked", this.model);
	}
});

App.ExercisesListView = Backbone.View.extend({

	initialize : function () {
		this.collection.on("add", this.onAdd, this);
		this.collection.on("remove", this.onRemove, this);
		this.collection.on("reset", this.onReset, this);
		this.$exerciseView = $("#exercise-view");
		this.currentExercise = false;
		this.currentExerciseView = false;
		this.exViewModelPairs = [];
	},

	renderExListItemView : function (exercise) {
		var exLiView = new App.ExerciseListItemView({
					model : exercise,
					collection : self
				});

		exLiView.bind("exClicked", this.onExClicked, this);
		this.exViewModelPairs.push([exLiView, exercise]);
		this.$el.append(exLiView.render().el);
	},

	render : function () {
		var self = this;

		this.collection.each(function (exercise) {
			self.renderExListItemView(exercise);
		});

		return this;
	},

	onAdd : function (exercise) {
		this.renderExListItemView(exercise)

		if (this.currentExercise === false) {
			// If this is the first exercise that has been added, then render it to 
			// the screen
			var newExercise = this.collection.last(),
				newExerciseView = new App.ExerciseView({
					model: newExercise
				});

			this.$exerciseView.html(newExerciseView.render().$el);
			// Set it to be the active exercise
			newExercise.set({ current: true });
			this.currentExercise = newExercise;
			this.currentExerciseView = newExerciseView;
		} else {
			this.onExClicked(this.collection.last());
		}
	},

	onExClicked : function (exercise) {
		if (exercise !== this.currentExercise) {
			this.currentExercise.deselectEqRuleAndNode();
			this.currentExerciseView.close();
			this.currentExercise.set({ current: false });
			
			// Only save the exercise if it belongs to a user.
			if (!this.currentExercise.isNew()) {
				this.currentExercise.save();
			}

			exercise.set({ current: true });
			this.currentExercise = exercise;
			this.currentExerciseView = new App.ExerciseView({
				model: this.currentExercise
			});
			this.$exerciseView.html(this.currentExerciseView.render().$el);
		}
	},


	// TODO: This function may well be useless - along with the "remove" event
	// Apart from if we want to let users delete exercises?
	onRemove : function (exercise) {
		// Find the view, exercise pair that holds the exercise being deleted.
		var exViewModelPairToRemove = _.find(this.exViewModelPairs, function (pair) {
			return pair[1] === exercise;
		});

		// Remove the view from the DOM
		exViewModelPairToRemove[0].remove();

		// Remove the view, exercise pair from the array 
		this.exViewModelPairs = _.without(this.exViewModelPairs, exViewModelPairToRemove);
	},

	onReset : function () {
		// For each of the [view, exercise] pairs
		_.each(this.exViewModelPairs, function (pair) {
			// Remove the view from the DOM
			pair[0].remove()
		});

		// There are no longer any [view, exercise] pairs
		this.exViewModelPairs = [];

		// Empty the current exercise view
		this.$exerciseView.empty();
		this.currentExercise = false;
		this.currentExerciseView = false;
	}
});

App.ExerciseManager = Backbone.Model.extend({

	initialize: function () {
		App.vent.on("userLoggedIn", this.onUserLoggedIn, this);
		App.vent.on("userLoggingOut", this.onUserLoggingOut, this);
	},

	getCurrentExercise : function () {
		return this.get("exercises").find(function (ex) { return ex.get("current"); });
	},

	getNewExercise: function () {
		var newExerciseView = new App.NewExerciseView({});
		newExerciseView.render();
	},

	addNewExercise: function (newExStartWff, newExFinishWff) {
		this.get("exercises").add([{
			inputSet : new App.Steps([{
				node : newExStartWff,
				rule : "Start Wff",
				no : 1,
				from : null,
				unused : false
			}]),

			goalSet : new App.Steps([{
				node : newExFinishWff,
				rule : "Finish Wff",
				no : 1,
				from : null,
				unused : false
			}])
		}]);
	},

	onUserLoggedIn : function () {
		var self = this,
			unsavedEqRules = this.get("exercises").rest(35);

		// TODO: replace this with a button that lets the user save individual exercises
		// This button should be visible on everything but the current exercise.
		/*
		this.get("exercises").each( function(ex) {
			ex.save();
		});*/

		$.ajax({
			
			url : 'api/userExercises',
			type : "GET",
			contentType : "application/json",
			dataType : "json",

			processData : false,

			success : function (data) {
				if (!data.error && data.exercises.length > 0) {
					_.each(data.exercises, function (ex) {
						ex = App.Exercise.parse(ex);
						// Set current to false for all, this is handled by the listview.
						ex.current = false;
					});

					self.get("exercises").add(data.exercises);
				} else {
					console.log("Error: " + data.error);
				}
			},

			failure : function (data) {
				console.log("Error: " + data.error);
			}
		});
	},

	onUserLoggingOut : function () {
		if (App.exercisesListView.currentExercise) {
			App.exercisesListView.currentExercise.save(); // Save the current exercise
			App.exercisesListView.currentExerciseView.close();
			this.get("exercises").reset(); // Delete all the exercises
		}
	}
});