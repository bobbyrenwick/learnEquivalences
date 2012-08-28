var App = App || {};

// Each Step holds any type of node
App.Step = Backbone.Model.extend({

	defaults : {
		highlightedDel : false
	},

	toJSON : function () {
		var json = _.clone(this.attributes);
		json.node = json.node.toString();
		json.highlightedDel = false;
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
		this.model.on("change:highlightedDel", this.onChangeHighlightedDel, this);

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
	},

	onChangeHighlightedDel : function () {
		if (this.model.get("highlightedDel")) {
			this.$(".node").eq(0).addClass("highlightedDel");
		} else {
			this.$(".node").eq(0).removeClass("highlightedDel");
		}
	},

	onClose : function () {
		this.nodeView.close();
		this.model.off(null, null, this);
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

	renumber : function () {
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

		if (idxCameFrom !== null) {
			steps.push(idx);
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
			itsChildren,
			i,
			noSteps = this.length;

		// Find all the indexes of steps in front of this one
		// that rely upon this one and add to steps.
		for (i = idx + 1; i < noSteps; i++) {
			if (this.at(i).get("from") === (idx + 1)) {
				itsChildren = this.findChildSteps(i);
				steps = steps.concat(itsChildren);
			}
		}

		return steps;
	},

	highlightForDel : function (idxs) {
		var self = this;

		_.each(idxs, function(i) {
			self.at(i).set({
				highlightedDel : true
			});
		});
	},

	removeDelHighlights : function () {
		this.each(function (step) {
			step.set({ highlightedDel : false });
		});
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
		pairToRemove[0].close();

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
	},

	onClose : function () {
		// Remove all bindings to callbacks for events for the Steps within this context.
		this.collection.off(null, null, this);
		
		_.each(this.stepViewModelPairs, function(pair) {
			// Remove all callbacks the nodeview within this context.
			pair[0].nodeView.off(null, null, this);
			pair[0].close();
		});
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
			"class": "alert alert-block " + this.model.get("type")
		};
	},

	initialize: function () {
		// Go through and add the options to this view - used for when events are passed through
		// to the constructor and their counterpart functions.
		for (i in this.options) {
			if (i !== "model") {
				this[i] = this.options[i];
			}
		}
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON()),
			buttons = this.model.get("buttons"),
			$buttonsP,
			self = this;

		this.$el.html(renderedContent);

		if (buttons) {
			$buttonsP = $("<p></p>").appendTo(this.$el);
			_.each(buttons, function(btn) {
				var button = self.make("button", { "class" : btn[1] }, btn[0]);
				$buttonsP.append(button);
				$buttonsP.append("&nbsp;");
			});
		}

		// If the alert is set to disappear, make it happen
		if (this.model.get("delay")) {
			setTimeout(function () {
				self.$el.alert("close");
			}, this.model.get("delay"));
		}

		/*if (this.model.get("progress")) {
			this.increaseProg();
		}*/

		return this;
	},

	increaseProg : function () {
		var width = 0,
			$bar = this.$("div.bar");

		(function inc() {
			var newWidth = parseInt($bar[0].style.width) + 10;
			$bar[0].style.width = newWidth + "%";

			if (newWidth < 100) { setTimeout(inc, 1000); }
		})();
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
		hintAvailable : true,
		completed : false,
		completedInputSet : null,
		completedGoalSet : null
	},

	initialize: function () {
		// Only when currently selected stuff changes should the function be called
		// Have defined custom event changeCurrentlySelectedNodeEtc - stops event from firing three times 
		// when node/step/steps is updated - cannot use global change event as this includes other attrs.
		this.on("change:currentlySelectedEqRule changeCurrentlySelectedNodeEtc", this.onChangeSelections, this);

		if (this.get("exerciseString") === undefined && this.get("undoDelObj") === undefined) {
			this.set({
				// The equivalence that is to be proved with an equivalence sign in the middle
				exerciseString : this.get("inputSet").at(0).get("node").toString() + " \u2261 " + this.get("goalSet").at(0).get("node").toString(),
				// An array that holds references to the last steps that were deleted.
				undoDelObj : {
					stepsDelFrom : "",
					steps : new App.Steps()
				}
			});
		}
	},

	getCurrentlySelectedStepIdx : function () {
		if (this.get("currentlySelectedSteps") && this.get("currentlySelectedStep")) {
			return this.get("currentlySelectedSteps").indexOf(this.get("currentlySelectedStep"));
		}
		return null;
	},

	onChangeSelections : function () {
		console.log("onChangeSelections called");
		var currentStepsString;
		// Update the tree visualisations to reflect the change in selection.
		if(!this.get("currentlySelectedNode")) { // If there is no node selected, deselect all nodes in the visualisations
			App.inputSetTreeVis
				.updateData(this.get("inputSet").last())
				.removeAllHighlights();
			App.goalSetTreeVis
				.updateData(this.get("goalSet").last())
				.removeAllHighlights();
		} else {
			currentStepsString = this.get("currentlySelectedSteps").getStepsString();
			App[currentStepsString + "TreeVis"]
				.updateData(this.get("currentlySelectedStep"))
				.highlightFromId(this.get("currentlySelectedNode").cid);
		}

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
	deselectEqRuleAndNode : function () {
		this.deselectNode();
		this.deselectEqRule();
	},

	// Deselects the currently active equivalence rule
	deselectEqRule : function () {
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
		App.vent.trigger("formulaDeselected");
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

		if (eqRule.get("rule") === "Rename Variable" && fwdMatchingPairs) {
			modalView = new App.RenameVariableModalView({
				model : new App.RenameVariableModal ({
					"node" : node,
					"step" : step,
					"eqRule" : eqRule	
				})
			});
			// Bind events in the modal dialog to functions in this context so that the correct
			// action can be taken.
			modalView.on("modalSuccess", this.onModalSuccess, this);
			modalView.on("modalChooseFail", this.onModalChooseFail, this);
			// Display the modal dialog
			modalView.render();
		} else if (eqRule.get("bidirectional") && bwdMatchingPairs && fwdMatchingPairs) {
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
			modalView.on("modalSuccess", this.onModalSuccess, this);
			modalView.on("modalChooseFail", this.onModalChooseFail, this);
			// Display the modal dialog
			modalView.render();
		} else if (eqRule.get("bidirectional") && bwdMatchingPairs) {
			// If backwards application requires formula introduction
			if (eqRule.get("bwdIntroSymbols").quantifiers.length  + eqRule.get("bwdIntroSymbols").symbols.length > 0) {
				// Ask user what formulas should be introduced
				this.createWffIntroModalView(node, step, eqRule, bwdMatchingPairs, -1);
			} else {
				this.applyRuleAndAddStep(eqRule, -1, bwdMatchingPairs, node, step, steps);
			}
		} else if (fwdMatchingPairs) {
			// If forwards application requires formula introduction
			if (eqRule.get("fwdIntroSymbols").quantifiers.length + eqRule.get("fwdIntroSymbols").symbols.length > 0) {
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
		var lastAddedSteps = this.get(this.get("lastStepsAddedTo")),
			lastAddedStep = lastAddedSteps.last(),
			oppositeSet = this.getOppositeSet(lastAddedSteps),
			lastAddedStepString = lastAddedStep.get("node").toString(),
			idxOfMatchingStep = -1,
			lastStepFrom,
			usedSteps = [],
			self = this,
			isPrevSolution;

		oppositeSet.each(function (step, idx) { // Go through each of the steps in opposite set
			if (step.get("node").toString() === lastAddedStepString) { // Then we have a match - exercise complete!
				idxOfMatchingStep = idx;
			
				// Display the unused steps
				lastAddedSteps.showUnusedSteps(lastAddedSteps.length - 1);
				oppositeSet.showUnusedSteps(idxOfMatchingStep);
				
				isPrevSolution = Boolean(self.get("completedInputSet"));
				self.set({ completed : true, undoAvailable : false });
				
				// If this is the first solution for this exercise - save the completed version into completed(input/goal)Set
				// If it isn't the first solution then the alert in ExerciseView asks if they want to overwrite
				if (!isPrevSolution) { 
					self.saveCompletedVersion();
				}

				// Trigger creation of an alert in ExerciseView
				self.trigger("exerciseCompleted", isPrevSolution); 
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
			self.get(completedSteps).renumber();
		});

		// Remove all but the start, finish wff silently.
		this.silentReset();
	},

	silentReset : function () {
		this.get("inputSet").remove(this.get("inputSet").rest(1), { silent : true });
		this.get("goalSet").remove(this.get("goalSet").rest(1), { silent : true });
	},

	// Adds a new step to steps, with newWff as it's node and the rule text and direction it was used in
	addNewStep : function (newWff, steps, rule, direction, fromStep) {
		var newStep = new App.Step({
				node: newWff,
				rule: rule.get("rule") + " " + (direction > 0 ? "ltr" : (direction === 0 ? "" : "rtl")),
				no : steps.length + 1,
				from : fromStep.get("no"),
				unused : false
			});

		// Add the new step to the steps collection
		steps.add(newStep);

		this.set("lastStepsAddedTo", steps.getStepsString());
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
		modalView.on("modalSuccess", this.onModalSuccess, this);
		modalView.on("modalChooseFail", this.onModalChooseFail, this);
		modalView.render();
	},

	// obj contains newWff, direction and if from WriteNextStepModal - step, steps, eqRule

	onModalSuccess : function (obj) {
		this.addNewStep(obj.newWff, obj.steps || this.get("currentlySelectedSteps"), obj.eqRule || this.get("currentlySelectedEqRule"), obj.direction, obj.step || this.get("currentlySelectedStep"));
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
		obj.modal.off("modalChooseFail", this.onModalChooseFail);
		obj.modal.off("modalSuccess", this.onModalSuccess);
	},

	onHintSuccess : function (obj) {
		this.addNewStep(obj.newWff, obj.steps || this.get("currentlySelectedSteps"), obj.eqRule || this.get("currentlySelectedEqRule"), obj.direction, obj.step || this.get("currentlySelectedStep"));
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
	},

	onModalChooseFail : function (obj) {
		// The user closed the modal dialog so it may be they made a mistake
		// so, deselect the chosen equivalence rule
		this.deselectEqRule();
		obj.modal.off("modalChooseFail", this.onModalChooseFail);
		obj.modal.off("modalSuccess", this.onModalSuccess);
	},

	applyRuleAndAddStep : function (eqRule, direction, matchingPairs, node, step, steps) {
		// Apply the selected rule fwd, given the matching pairs, selected subF and whole formula
		var newWff = eqRule.applyRule(direction, matchingPairs, node, step.get("node"));
			
		// Add the resulting step to the currently selected steps.
		this.addNewStep(newWff, steps, eqRule, direction, step);
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
	},

	resetUndo : function () {
		this.set({ 
			undoAvailable : false, 
			undoDelObj : {
				stepsDelFrom : "",
				steps : new App.Steps()
			} 
		});
	},

	undo : function () {
		var undoDelObj = this.get("undoDelObj"),
			steps = this.get(undoDelObj.stepsDelFrom),
			noUndoSteps = undoDelObj.steps.length,
			noUndoStepsMinus = noUndoSteps - 1,
			curNoSteps = steps.length;
		
		if (this.get("undoAvailable")) {
			
			for (var i = noUndoStepsMinus; i >=0; i--) {
				var step = undoDelObj.steps.at(i);

				// remove highlight
				step.set("highlightedDel", false);

				// If this is the first to be readded, just need to change its number
				if (i === noUndoStepsMinus) {
					step.set("no", curNoSteps + 1);
				} else {
					step.set({
						no : curNoSteps + 1,
						from : curNoSteps
					})
				}

				// Add the step
				steps.add(step);
				curNoSteps++;
			}

			// Disable the undo feature and reset obj
			this.resetUndo();
		}
	},

	unstack : function (idx) {
		var steps = this.get("currentlySelectedSteps"),
			stepsString = steps.getStepsString(),
			i,
			noSteps = steps.length,
			j,
			allStepsIncChildren = steps.findChildSteps(idx),
			self = this,
			undoStepToDel,
			undoStepToDelIdx;

		// If there were some things previously deleted but not undone - discard forever
		this.resetUndo();
		this.get("undoDelObj").stepsDelFrom = stepsString;

		for (i = noSteps - 1; i >= 0; i--){ // Working backwards through all the steps
			if (allStepsIncChildren.indexOf(i) >= 0) { // If i is an index of a step that needs to be deleted.

				// Add a reference to the current step to the undoDelObj
				this.get("undoDelObj").steps.add(steps.at(i));

				// Remove the step from the current steps
				steps.remove(steps.at(i)); 
				noSteps--; 
				// Walk forward through all of the steps that were in front of this one
				for (j = i; j < noSteps; j++) {
					steps.at(j).set("no", steps.at(j).get("no") - 1); // minus one from the number and the from
				}

				this.deselectEqRuleAndNode();
			}
		}

		this.set("undoAvailable", true);
	},

	toJSON : function () {
		// toJSON is called automatically on all the steps, so no need to call here.
		var json = _.clone(this.attributes);
		json.currentlySelectedSteps = null;
		json.currentlySelectedStep = null;
		json.currentlySelectedNode = null;
		json.currentlySelectedEqRule = null;
		json.unstackAvailable = false;
		return json;
	},

	parse : function (response) {
		return App.Exercise.parse(response);
	}
}, {

	parse : function (exJSON) {
		exJSON.inputSet = App.Exercise.stepArrayToSteps(exJSON.inputSet); 
		exJSON.goalSet = App.Exercise.stepArrayToSteps(exJSON.goalSet);
		exJSON.completedInputSet = App.Exercise.stepArrayToSteps(exJSON.completedInputSet);
		exJSON.completedGoalSet = App.Exercise.stepArrayToSteps(exJSON.completedGoalSet);
		exJSON.undoDelObj.steps = App.Exercise.stepArrayToSteps(exJSON.undoDelObj.steps);
		return exJSON;
	},

	stepArrayToSteps : function (stepArr) {
		return new App.Steps(
			_.map(stepArr, function (step) {
				step.node = App.parser.parse(step.node);
				return new App.Step(step);
			})
		);
	}
});

// Holds the two steps collection views
App.ExerciseView = Backbone.View.extend({

	template : _.template($("#exerciseTemplate").html()),

	events : {
		"click .btn-hint" : "onHintClick",
		"click .btn-undo" : "onUndoClick",
		"click .btn-unstack" : "onUnstackClick",
		"mouseenter .btn-unstack" : "onUnstackMouseenter",
		"mouseleave .btn-unstack" : "onUnstackMouseleave",
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

		this.model.on("exerciseCompleted", this.createCompletedAlert, this);

		// Bind to the Exercise's undo and unstack availablity members changing.
		this.model.on("change:undoAvailable", this.onChangeUndoAvailable, this);
		this.model.on("change:unstackAvailable", this.onChangeUnstackAvailable, this);
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());

		// Bind to centralised hub event that is triggered by the EquivalenceRuleView that has been
		// clicked on to select a certain eq rule.
		App.vent.on("currentlySelectedEqRuleChange", this.onEqRuleSelected, this);

		// Bind to the central event triggered by clicking on a node in the TreeVis
		App.vent.on("treeVisNodeClick", this.onTreeVisNodeClick, this);

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

		this.$('.btn-unstack').tooltip({
			title : "This will remove all steps highlighted in red. Be warned - only the last delete can be undone at any time.",
			placement : "bottom",
			trigger : "manual"
		});

		App.inputSetTreeVis.updateData(this.model.get("inputSet").last());
		App.goalSetTreeVis.updateData(this.model.get("goalSet").last());

		return this;
	},

	onNodeSelected: function (nodeView, step, steps) {
		// Should only do something if there is no alert being shown.
		if (!this.successAlertView) {
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
				App.vent.trigger("formulaSelected", nodeView.model);
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
					type: "fade in", // normal yellow
					closable: true,
					delay: 4000,
					progress : false
				})
			});

		// Place the alert inbetween the 2 answer sections (input set and goal set)
		this.$(".answerSection").eq(0).after(newAlertView.render().$el);
	},

	createCompletedAlert : function (isPrevSolution) {
		var self = this;

		if (!isPrevSolution) {
			this.successAlertView = new App.AlertView({
				model : new App.Alert({
					heading : "Exercise Complete",
					body : "You have successfully completed the exercise. Any unused steps have been crossed out. The solution has been saved and can be accessed by clicking the eye next to the exercise.",
					type : "alert-success fade in", // green for success
					closable : false,
					delay : false,
					progress : false	
				})
			});
		} else { // Create an alert view that gives the user the option to save this new solution.
			this.successAlertView = new App.AlertView({
				events : {
					"click .btn-info" : "overwriteClicked",
					"click .btn-no" : "noClicked"
				},

				model : new App.Alert({
					heading : "Exercise Completed Again",
					body : "You have successfully completed the exercise again. Would you like to overwrite your previous solution?",
					type : "alert-info fade in", // blue for success
					closable : false,
					delay : false,
					buttons : [["Overwrite", "btn btn-info"], ["No thanks.", "btn btn-no"]],
					progress : false
					// [btn text, btn classes]
				}),

				overwriteClicked : function (e) {
					// self refers to ExerciseView
					self.model.saveCompletedVersion();
					// this refers to the AlertView
					this.$("p").html("The new solution has been saved.");
				},

				noClicked : function (e) {
					// self refers to ExerciseView, just remove the solution for next time
					self.model.silentReset();
					// this refers to the AlertView
					this.$("p").html("The new solution has been discarded.");
				}
			});
		}

		// Place the alert inbetween the 2 answer sections (input set and goal set)
		this.$(".answerSection").eq(0).after(this.successAlertView.render().$el);
		this.$('.writeBtns').addClass("hide");
	},

	onChangeUndoAvailable : function () {
		if (this.model.get("undoAvailable")) {
			this.$(".btn-undo").removeAttr("disabled");
		} else {
			this.$(".btn-undo").attr("disabled", true);
		}
	},

	onUndoClick : function () {
		this.model.undo();
	},

	onHintClick : function () {
		if (!this.successAlertView) {
			// Generate an alert that says a hint is being created.
			var hintAlertView = new App.AlertView({
					model : new App.Alert({
						heading : "Generating Hint",
						body : "Please wait while we find the next best step for you.",
						type : "alert-info", // blue for success
						closable : false,
						delay : false,
						progress : true
					})
				}),
				lastInputFormula = this.model.get("inputSet").last().get("node"),
				lastGoalFormula = this.model.get("goalSet").last().get("node"),
				prob = new App.Problem(App.backboneToNormal(lastInputFormula),
									   App.backboneToNormal(lastGoalFormula)),
				newStep,
				stepsToAddTo,
				solution
				self = this;

			this.$("div.inputSetWrite").after(hintAlertView.render().$el);

			// Give a timeout in order for the alertview to be given time to render
			setTimeout(function () {
				solution = App.breadthFirstSearchBothDirectionsHashPrTimed(prob);

				if (typeof solution === "string") { // We know something has gone wrong
					hintAlertView.$el.text(solution);
					setTimeout(function () { hintAlertView.$el.alert("close"); }, 3000);
				} else {

					if (solution instanceof App.OneSidedSolution) {
						newStep = solution.fwdSideArr ? solution.fwdSideArr[1] : solution.bwdSideArr[1];
						stepsToAddTo = solution.fwdSideArr ? self.model.get("inputSet") : self.model.get("goalSet");
					} else if (solution.fwdSideArr >= solution.bwdSideArr) {
						newStep = solution.fwdSideArr[1];
						stepsToAddTo = self.model.get("inputSet");
					} else {
						newStep = solution.bwdSideArr[1];
						stepsToAddTo = self.model.get("goalSet");
					}

					hintAlertView.$el.alert("close");

					self.model.onHintSuccess({
						newWff : newStep.backboneState,
						steps : stepsToAddTo,
						eqRule : newStep.eqRule,
						direction : newStep.direction,
						step : stepsToAddTo.last()
					});
				}
			}, 10);
		}
	},

	onChangeUnstackAvailable: function () {
		if (this.model.get("unstackAvailable")) {
			this.$(".btn-unstack").removeAttr("disabled");
		} else {
			this.$(".btn-unstack").attr("disabled", true);
		}
	},

	onUnstackClick : function () {
		var selectedStepIdx = this.model.getCurrentlySelectedStepIdx();
		if (selectedStepIdx !== null && selectedStepIdx > -1){
			this.model.unstack(selectedStepIdx);
			this.$('.btn-unstack').tooltip("hide");
		}
	},

	onUnstackMouseenter : function () {
		var curSteps = this.model.get("currentlySelectedSteps"),
			selectedStepIdx = this.model.getCurrentlySelectedStepIdx(),
			stepIndexes;

		if (selectedStepIdx !== null && selectedStepIdx > -1) {
			stepIndexes = curSteps.findChildSteps(selectedStepIdx);
			curSteps.highlightForDel(stepIndexes);
			this.$('.btn-unstack').tooltip("show");
		}
	},

	onUnstackMouseleave : function () {
		var curSteps = this.model.get("currentlySelectedSteps"),
			curStepsView = (this.inputSetView.collection === curSteps ? this.inputSetView : this.goalSetView);
		if (this.model.get("unstackAvailable")) {
			curSteps.removeDelHighlights();
			this.$('.btn-unstack').tooltip("hide");
		}
	},

	createWriteNextStepModalView : function (set) {
		var writeNextStepModal = new App.WriteNextStepModalView({
				model : new App.WriteNextStepModal({
					steps : this.model.get(set),
					lastStep : this.model.get("currentlySelectedStep")
				})
			});

		writeNextStepModal.on("modalSuccess", this.model.onModalSuccess, this.model);
		writeNextStepModal.render();
	},

	onInputSetWrite : function () {
		this.model.deselectEqRule();
		this.createWriteNextStepModalView("inputSet");
	},

	onGoalSetWrite : function () {
		this.model.deselectEqRule();
		this.createWriteNextStepModalView("goalSet");
	},

	onClose : function () {
		
		// Unbind from centralised hub event so that only the one currently displayed receives this update
		App.vent.off(null, null, this);
		// Remove all bindings to model
		this.model.off(null, null, this);
		
		// Remove all bindings to the input and goal StepsViews
		this.inputSetView.off();
		this.goalSetView.off();

		// Close the input and goal StepsViews
		this.inputSetView.close();
		this.goalSetView.close();

		if (this.successAlertView) { // If there is a success alert view
			if (this.successAlertView.$(".btn-no").length > 0) { // If it has btns still visible, click no.
				this.successAlertView.$(".btn-no").click();
			}
		}

		App.vent.trigger("closedExerciseView");

		console.log("Closed ExerciseView");
	},


	onTreeVisNodeClick : function (set, cid) {
		var self, currentStepView;
		if (!this.model.get("currentlySelectedStep") || this.model.get("currentlySelectedSteps").getStepsString() !== set) { // If there isn't a currently selected step.
			// d3 is currently displaying the last step within set
			_.last(this[set + "View"].stepViewModelPairs)[0].nodeView.clickOnAnswerNode(cid);
		} else {
			self = this;
			currentStepView = _.find(this[set+"View"].stepViewModelPairs, function (p) { return p[1] === self.model.get("currentlySelectedStep")  })[0];
			currentStepView.nodeView.clickOnAnswerNode(cid);
		}
	}
});

App.SolutionView = Backbone.View.extend({

	template : _.template($("#solutionTemplate").html()),

	initialize: function () {
		// Create the input set and goal set
		this.inputSetView = new App.StepsView({ collection: this.model.get("completedInputSet"), backwards: false });
		this.goalSetView = new App.StepsView({ collection: this.model.get("completedGoalSet"), backwards: true });
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());

		this.$el.html(renderedContent);
		// Render the input set
		this.$el.append(this.inputSetView.render().$el);
		this.$el.append(this.goalSetView.render().$el);

		return this;
	},

	onClose : function () {
		// Close the input and goal StepsViews
		this.inputSetView.close();
		this.goalSetView.close();
	}
});

App.Exercises = Backbone.Collection.extend({
	model : App.Exercise,
});

App.ExerciseListItemView = Backbone.View.extend({

	events : {
		"click a" : "onExerciseClick",
		"click .icon-eye-open" : "onSolutionClick",
		"mouseenter .icon-eye-open" : "onSolutionMouseenter",
		"mouseleave .icon-eye-open" : "onSolutionMouseleave",
		"click .icon-share" : "onAddToEqRulesClick",
		"mouseenter .icon-share" : "onAddToEqRulesMouseenter",
		"mouseleave .icon-share" : "onAddToEqRulesMouseleave"
	},

	tagName: "li",
	className: "exerciseListItem",
	template: _.template($("#exerciseListItemTemplate").html()),

	initialize: function () {
		this.model.on("change:current", this.onCurrentChange, this);
		this.model.on("change:completed", this.addCompletedBtns, this);
	},

	render: function () {
		var renderedContent = this.template({
			"exercise" : this.model.get("exerciseString")
		});

		this.$el.html(renderedContent);
		
		if (this.model.get("current")) {
			this.$el.addClass("active");
		}

		if (this.model.get("completed")) {
			this.addCompletedBtns();
		}

		return this;
	},

	addCompletedBtns : function () {
		this.$el.prepend("<i class=\"pull-right icon-eye-open\"></i><i class=\"pull-right icon-share\"></i>");
			
		this.$('.icon-eye-open').tooltip({
			title : "Open saved solution",
			placement : "left",
			trigger : "manual"
		});

		this.$('.icon-share').tooltip({
			title : "Add as equivalence rule",
			placement : "left",
			trigger : "manual"
		});
	},

	onCurrentChange : function () {
		if (this.model.get("current")) {
			this.$el.addClass("active");
		} else {
			this.$el.removeClass("active");
		}
	},

	onExerciseClick : function (e) {
		e.preventDefault();
		e.stopPropagation();
		this.trigger("exClicked", this.model);
	},

	onSolutionClick : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.trigger("solutionClick", this.model);
	},

	onSolutionMouseenter : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.$('.icon-eye-open').tooltip("show");
	},

	onSolutionMouseleave : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.$('.icon-eye-open').tooltip("hide");
	},

	onAddToEqRulesClick : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.trigger("addToEqRulesClick", this.model);
	},

	onAddToEqRulesMouseenter : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.$('.icon-share').tooltip("show");
	},

	onAddToEqRulesMouseleave : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.$('.icon-share').tooltip("hide");
	},

	onClose : function () {
		this.model.off(null, null, this);
	}
});

App.ExercisesListView = Backbone.View.extend({

	initialize : function () {
		this.collection.on("add", this.onAdd, this);
		this.collection.on("remove", this.onRemove, this);
		this.collection.on("reset", this.onReset, this);

		// Bind to the event that a user's equivalence rule.
		App.vent.on("eqRuleSolutionClick", this.onEqRuleSolutionClick, this);
		
		this.$exerciseView = $("#exercise-view");
		this.currentExercise = null;
		this.currentExerciseView = null;
		this.currentSolution = null;
		this.currentSolutionView = null;
		this.exViewModelPairs = [];
	},

	renderExListItemView : function (exercise) {
		var exLiView = new App.ExerciseListItemView({
				model : exercise,
				collection : self
			});

		exLiView.on("exClicked", this.onExClicked, this);
		exLiView.on("solutionClick", this.onSolutionClick, this);
		exLiView.on("addToEqRulesClick", this.onAddToEqRulesClick, this);
		
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

	closeCurrentExercise : function () {
		this.currentExercise.deselectEqRuleAndNode();
		this.currentExerciseView.close();
		this.currentExercise.set({ current: false });

		// Only save the exercise if it belongs to a user.
		if (App.userManager.isLoggedIn()) {
			this.currentExercise.save();
		}

		this.currentExercise = null;
		this.currentExerciseView = null;
	},

	closeCurrentSolution : function () {
		this.currentSolutionView.close();
		this.currentSolution.set({ current : false });

		this.currentSolution = null;
		this.currentSolutionView = null;
	},

	closeWhateverCurrent : function () {
		if (this.currentExercise) { // if there is an exercise open, close it.
			this.closeCurrentExercise();
		} else if (this.currentSolution) { // if there is a solution open, close it.
			this.closeCurrentSolution();
		}
	},

	onExClicked : function (exercise) {
		if (exercise !== this.currentExercise) {
			this.closeWhateverCurrent();

			exercise.set({ current: true });
			this.currentExercise = exercise;
			this.currentExerciseView = new App.ExerciseView({
				model: this.currentExercise
			});
			this.$exerciseView.html(this.currentExerciseView.render().$el);
		}
	},

	onSolutionClick : function (exercise) {
		if (exercise !== this.currentSolution) { // only do something if not currently looking at this solution
			this.closeWhateverCurrent();

			exercise.set({ current: true });
			this.currentSolution = exercise;
			this.currentSolutionView = new App.SolutionView({
				model : exercise
			});
			
			this.$exerciseView.html(this.currentSolutionView.render().$el);
		}
	},

	onAddToEqRulesClick : function (exercise) {
		var newEqRuleView = new App.NewEqRuleModalView({
			model: new App.NewEqRuleModal({
				"collection": App.equivalenceRules,
				"Left Hand Side" : exercise.get("inputSet").at(0).get("node").toString(),
				"Right Hand Side" : exercise.get("goalSet").at(0).get("node").toString(),
				"fromExercise" : this.collection.indexOf(exercise)
			})
		});

		newEqRuleView.render();
	},

	// TODO: This function may well be useless - along with the "remove" event
	// Apart from if we want to let users delete exercises?
	onRemove : function (exercise) {
		// Find the view, exercise pair that holds the exercise being deleted.
		var exViewModelPairToRemove = _.find(this.exViewModelPairs, function (pair) {
			return pair[1] === exercise;
		});

		// Remove the view from the DOM
		exViewModelPairToRemove[0].close();

		// Remove the view, exercise pair from the array 
		this.exViewModelPairs = _.without(this.exViewModelPairs, exViewModelPairToRemove);
	},

	onReset : function () {
		// For each of the [view, exercise] pairs
		_.each(this.exViewModelPairs, function (pair) {
			// Remove the view from the DOM
			pair[0].close();
		});

		// There are no longer any [view, exercise] pairs
		this.exViewModelPairs = [];

		// Empty the current exercise view
		this.$exerciseView.empty();
		this.currentExercise = null;
		this.currentExerciseView = null;
	},

	onEqRuleSolutionClick : function (exerciseIdx) {
		this.onSolutionClick(this.collection.at(exerciseIdx));
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

	addNewExercise: function (newExStartWff, newExFinishWff, isPredicate) {
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
			}]),

			predicate : isPredicate
		}]);
	},

	onUserLoggedIn : function () {
		var self = this;

		this.get("exercises").reset();

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

	onUserLoggingOut : function (options) {
		var saveOpt = options || { async : true };
		if (App.exercisesListView.currentExercise) {
			App.exercisesListView.currentExerciseView.close();
			App.exercisesListView.currentExercise.save({}, saveOpt); // Save the current exercise after closing
		} else if (App.exercisesListView.currentSolution){
			App.exercisesListView.currentSolutionView.close();
		}
		
		this.get("exercises").reset(); // Delete all the exercises
	}
});


// Generates formulae in normal js objects for speed
App.ExerciseGenerator = Backbone.Model.extend({

	initialize : function () {
		this.set({
			"atoms" : ["P", "Q", "R", "U", "V", "W", "X", "Y"],
			"predicates" : ["a", "b" , "c", "d", "e", "f", "g", "h"],
			"easyConstructors" : [App.NegationNodeNormal, App.AndNodeNormal, App.OrNodeNormal],
			"medConstructors" : [App.ImplyNodeNormal],
			"hardConstructors" : [App.DimplyNodeNormal],
			"predConstructors" : [App.UniversalQuantifierNormal, App.ExistensialQuantifierNormal]
		});
	},

	getEasyPropositional : function () {
		return this.generatePropExercise(this.get("easyConstructors"), 3, 3, 3);
	},

	getMediumPropositional : function () {
		return this.generatePropExercise(this.get("easyConstructors").concat(this.get("medConstructors")), 4, 3, 5);
	},

	getHardPropositional : function () {
		return this.generatePropExercise(this.get("easyConstructors").concat(this.get("medConstructors"), this.get("hardConstructors")), 4, 4, 9);
	},

	getEasyPredicate : function () {
		return this.generatePredExercise(this.get("easyConstructors"), 3, 3, 2, 4);
	},

	getMediumPredicate : function () {
		return this.generatePredExercise(this.get("easyConstructors"), 3, 3, 3, 6);
	},

	getHardPredicate : function () {
		return this.generatePredExercise(this.get("easyConstructors"), 3, 3, 4, 9);
	},

	// noDiffAtoms - min 0, max 8
	generatePropExercise : function (connectiveList, noConnectives, noDiffAtoms, noStepsAway) {
		var startingWff = this.generatePropFormula(connectiveList, noConnectives, noDiffAtoms),
			oneSecondFromStart = Date.now() + 1000,
			finishingWff;

		while (finishingWff === undefined) {
			// If still not found a finishingWff after a second, generate another startingWff
			if (Date.now() > oneSecondFromStart) {
				startingWff = this.generatePropFormula(connectiveList, noConnectives, noDiffAtoms);
				onSecondFromStart = Date.now() + 1000;
			}

			finishingWff = this.generateEquivalentFormula(startingWff, noStepsAway);
		}

		return [startingWff.toString(), finishingWff.toString()];
	},

	generatePredExercise : function (connectiveList, noConnectives, noDiffPredicates, noDiffQuantifiers, noStepsAway) {
		var startingWff = this.generatePredFormula(connectiveList, noConnectives, noDiffPredicates, noDiffQuantifiers),
			oneSecondFromStart = Date.now() + 1000,
			finishingWff;

		while (finishingWff === undefined) {
			// If still not found a finishingWff after a second, generate another startingWff
			if (Date.now() > oneSecondFromStart) {
				startingWff = this.generatePredFormula(connectiveList, noConnectives, noDiffPredicates, noDiffQuantifiers);
				onSecondFromStart = Date.now() + 1000;
			}

			finishingWff = this.generateEquivalentFormula(startingWff, noStepsAway);
		}

		return [startingWff.toString(), finishingWff.toString()];
	},

	generatePropFormula : function (connectiveList, noConnectives, noDiffAtoms) {
		var possAtoms = _.first(this.get("atoms"), noDiffAtoms),
			allFormulae = {},
			level = 2;

		// Generate all the atoms that can be done
		allFormulae[0] = _.map(possAtoms, function (symbol) {
			return new App.NodeNormal(symbol);
		});

		allFormulae[1] = _.map(allFormulae[0], function (atom) {
			return new App.NegationNodeNormal(atom);
		});

		while (level <= noConnectives) {
			allFormulae[level] = this.generateAllFormulae(connectiveList, level, allFormulae);
			level++;
		}

		var lastLevel = allFormulae[level - 1];

		return lastLevel[App.getRandomInt(0, lastLevel.length - 1)];
	},

	// The number of different quantifiers limits both the number of variables that can be used (as we
	// are making sentences) and also the maximum arity of our predicates.
	generatePredFormula : function (connectiveList, noConnectives, noDiffPredicates, noDiffQuantifiers) {
		var possPredicates = _.first(this.get("predicates"), noDiffPredicates);
		var allTerms = _.first(this.get("atoms"), noDiffQuantifiers);
		var powerSetTerms = _.rest(App.powerset(allTerms)); // rest removes the empty set
		var shuffledTerms = _.map(powerSetTerms, function (termArr) { return _.shuffle(termArr); });
		var shuffledNodes = _.map(shuffledTerms, function (termArr) {
				return _.map(termArr, function (term) {
					return new App.NodeNormal(term);
				})
			});
		var allFormulae = {};
		var level = 2;

		// Level 0 here is equivalent to creating all (not quite all as we are only doing 1 shuffle of each arr in power
		// set. TODO: make it all) the possible predicates with all possible combinations
		// up to the max arity of the variables as it's terms.
		allFormulae[0] = _.map(possPredicates, function (predSymbol) {
			// Pick a random shuffledNodes in order to keep the arity
			var terms = shuffledNodes[App.getRandomInt(0, shuffledNodes.length - 1)];
			return new App.PredicateNormal(predSymbol, terms);
		});

		allFormulae[1] = _.map(allFormulae[0], function (atom) {
			return new App.NegationNodeNormal(atom);
		});

		while (level <= noConnectives) {
			allFormulae[level] = this.generateAllFormulae(connectiveList, level, allFormulae);
			level++;
		}

		var lastLevel = allFormulae[level - 1];
		var randomFormula = lastLevel[App.getRandomInt(0, lastLevel.length - 1)];

		return this.quantifyFormula(randomFormula);
	},

	// Takes a formula, finds all the variables that occur free within the formula
	// places a random quantifier with that variable at the very front of the formula.
	quantifyFormula : function (formula) {
		var terms = App.getTerms(formula),
			freeTerms = _.filter(terms, function (t) {
				return App.EquivalenceRule.occursFreeQuick(t, formula);
			});

		// For each of the free terms, randomly create either a universal or existensial quantifier.
		_.each(freeTerms, function (t) {
			formula = (Math.random() > 0.5 ?
						new App.UniversalQuantifierNormal(t, formula) :
						new App.ExistensialQuantifierNormal(t, formula));
		});

		return formula;
	},

	generateAllFormulae : function (connectiveList, level, allFormulae) {
		var prevLvl = allFormulae[level -1],	
			thisLvl = [],
			noConstructors = connectiveList.length,
			self = this;

		_.each(prevLvl, function (prevFormula) {
			// Pick a random connective to be head of the tree.
			var newRoot = connectiveList[App.getRandomInt(0, noConstructors -1)],
				newFormula;

			if (newRoot.prototype.takes === 2) {
				// randomise whether the prevFormula goes on the left of right of the formula.
				if (Math.random() > 0.5) {
					newFormula = new newRoot(prevFormula, allFormulae[0][App.getRandomInt(0, allFormulae[0].length - 1)]);	
				} else {
					newFormula = new newRoot(allFormulae[0][App.getRandomInt(0, allFormulae[0].length - 1)], prevFormula);
				}
				
			} else if (newRoot.prototype.takes === 1) {
				newFormula = new newRoot(prevFormula);
			}

			// Add the new formula to this level
			thisLvl.push(newFormula);
		});

		return thisLvl;
	},

	// Takes a formula and generates another formula that is the result of steps (int)
	// applications of equivalence rules
	generateEquivalentFormula : function (formula, steps) {
		var stepsTaken = 0,
			subF,
			curSubF,
			applicableRules,
			resultingFormula,
			resultingFormulae = { 0 : [formula] },
			eqRule,
			dir,
			matchingPairs,
			allSteps = {};

		// Add the original formula to allSteps
		allSteps[formula.toString()] = 1;

		// For the number of steps required
		for (var stepsTaken = 1; stepsTaken <= steps; stepsTaken++) {
			// Create an array to hold the new formulae
			resultingFormulae[stepsTaken] = [];

			// Go through 20 random formulae (or all of them if < inn) 20 level below that exist and generate all possible
			// formulae from applying 1 equivalence rule to every sub formula.
			for (var noForm = 0, totalForms = resultingFormulae[stepsTaken - 1].length; noForm < 20 && noForm < totalForms; noForm++) {
				var randIdx = App.getRandomInt(0, resultingFormulae[stepsTaken -1].length - 1);
				var form = resultingFormulae[stepsTaken -1][randIdx];

				// Get all subformulae of current formula
				subF = [];
				form.getSubFormulae(subF);

				// For every subformula
				for (var iSub = 0, totalSubs = subF.length; iSub < totalSubs; iSub++) {
					// Cache the sub formula
					curSubF = subF[iSub];

					// Find all the applicable rules for the subF
					applicableRules = App.findApplicableEqRulesForEqGen(curSubF);

					// Add all the formulae that result from the application of the rules to resultingFormulae
					for (i = 0; i < applicableRules.length; i++) { // For both rules that are applicable fwds and bwds.
						for (j = 0, l = applicableRules[i].length; j < l; j++) { 
							eqRule = applicableRules[i][j];
							dir = (i === 0 ? 1 : -1); // If on first array of applicable rules then we're going fwds.
							
							matchingPairs = eqRule.isApplicableQuick(dir, curSubF);
							resultingFormula = eqRule.applyRuleQuick(dir, matchingPairs, curSubF, form);

							
							if (!allSteps[resultingFormula.toString()]) { // If this step hasn't already been used, add it to the new resultingFormulae
								allSteps[resultingFormula.toString()] = 1; 
								resultingFormulae[stepsTaken].push(resultingFormula);
							}
						}
					}
				}
			}
		}

		// Get the last level of steps
		var lastStepsLevel = resultingFormulae[stepsTaken - 1];

		// Return a random one of the last level
		return lastStepsLevel[App.getRandomInt(0, lastStepsLevel.length - 1)];
	}
});