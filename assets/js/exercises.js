var App = App || {};

// Each Step holds any type of node
App.Step = Backbone.Model.extend({
	toJSON : function () {
		var json = _.clone(this.attributes);
		json.node = json.node.toString();
		return json;
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
	},

	render: function () {
		var renderedContent = this.template({ rule : this.model.get("rule") });
		this.$el.html(renderedContent);
		this.$el.prepend(this.nodeView.deepRender().$el);
		return this; // seems unness but conventional
	}
});

// A collection of steps - needed for both the input and goal sets.
App.Steps = Backbone.Collection.extend({
	model: App.Step,

	initialize: function () {
		// do nothing
	},

	// A step is a current step if it is the most recently added step to the collection
	// Therefore check if the step passed in is the last in the collection.
	isCurrentStep: function (step) {
		return step === this.last();
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
	},

	render: function () {
		var $steps,
			collection = this.collection,
			self = this;

		// Render the StepsView container, passing nothing as it just contains
		// and empty ul.
		this.$el.html(this.template({}));
		$steps = this.$(".stepSet");

		collection.each(function (step) {
			var view = new App.StepView({
					model: step,
					collection: collection
				});

			// Bind all the nodes 
			view.nodeView.bindAll("symbolEnterToStep", self.onSymbolEnter, self);
			view.nodeView.bindAll("symbolLeaveToStep", self.onSymbolLeave, self);
			view.nodeView.bindAll("symbolClickToStep", self.onSymbolClick, self);

			if (self.backwards) {
				// Stack upwards
				$steps.prepend(view.render().$el);
			} else {
				// Stack downwards
				$steps.append(view.render().$el);
			}
		});

		return this;
	},

	getStepFromNode: function (nodeView) {
		// This returns the Step that contains the nodeView passed as the parameter
		// This relies on each step's list item having its cid as it's id attribute
		var stepCid = nodeView.$el.closest("li").attr("id");
		return this.collection.getByCid(stepCid);
	},

	onSymbolEnter: function (nodeView) {
		// Get the step model that holds the node that triggered the event
		var step = this.getStepFromNode(nodeView);
		// If this is either the current goal or current input then highlight
		if (this.collection.isCurrentStep(step)) {
			nodeView.$el.addClass("highlighted");
		}

	},

	onSymbolLeave: function (nodeView) {
		// Get the step model that holds the node that triggered the event
		var step = this.getStepFromNode(nodeView);

		// If this is either the current goal or current input and the node 
		// hasn't been selected, then remove the highlight
		if (this.collection.isCurrentStep(step) && !nodeView.model.get("selected")) {
			nodeView.$el.removeClass("highlighted");
		}
	},

	onSymbolClick: function (nodeView) {
		// Again, get the step that contains this nodeView
		var step = this.getStepFromNode(nodeView);

		// If this is current goal/input then trigger the symbol click event,
		// sending the nodeview that came through - the node view was needed
		// in order to find out 
		if (this.collection.isCurrentStep(step)) {
			this.trigger("symbolClick", nodeView, step, this.collection);
		}
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

	defaults: {
		current: false,
		completed: false,
		currentlySelectedNode: false,
		currentlySelectedStep: false,
		currentlySelectedEqRule: false,
		currentlySelectedSteps: false,
		undoAvailable: false,
		unstackAvailable: false
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
		this.set({ currentlySelectedEqRule : false });
	},

	// Deselects the currently active Node
	deselectNode: function () {
		// Set the currently selected rules active property to false
		if (this.get("currentlySelectedNode")) {
			this.get("currentlySelectedNode").set({ selected: false });
		}
		// Set the Exercise's record of selected node to false
		this.set({
			currentlySelectedNode: false,
			currentlySelectedStep: false,
			currentlySelectedSteps: false
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

		var oppositeSet = this.getOppositeSet(_.last(this.get("undoArray"))),
			// gets the last steps in the undo array and gets the last step from that set
			lastAddedWff = _.last(this.get("undoArray")).last().get("node").toString(),
			self = this;

		oppositeSet.each(function (step, idx) {
			if (step.get("node").toString() === lastAddedWff) {
				self.set({ completed : true });
				oppositeSet.remove(oppositeSet.rest(idx + 1));
			}
		});
	},

	// Adds a new step to steps, with newWff as it's node and the rule text and direction it was used in
	addNewStep : function (newWff, steps, rule, direction) {
		// Add the step to the steps collection
		steps.add({
			node: newWff,
			rule: rule.get("rule") + " " + (direction > 0 ? "forwards" : "backwards")
		});
		// Add the steps to the undoArray
		this.addToUndo(steps);
		//this.save();
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

	// obj contains newWff, direction and if from WriteNextStepModal - steps, eqRule

	onModalSuccess : function (obj) {
		this.addNewStep(obj.newWff, obj.steps || this.get("currentlySelectedSteps"), obj.eqRule || this.get("currentlySelectedEqRule"), obj.direction);
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
		this.addNewStep(newWff, steps, eqRule, direction);
		this.checkIfCompleted();
		this.deselectEqRuleAndNode();
	},

	addToUndo : function (steps) {
		this.get("undoArray").push(steps);
		if (this.get("undoArray").length === 1) { this.set({ undoAvailable : true }); }
	},

	undo : function () {
		var undoArray = this.get("undoArray");
		if (this.get("undoAvailable")) {
			// Removes the last Step from the Steps collection that was last added to
			_.last(undoArray).pop();
			// Remove the references to the Steps that was just used
			undoArray.pop();
			// If there is nothing else in the undoArray disable the undo feature.
			if (undoArray.length === 0) { this.set({ undoAvailable : false }); }
			// If the exercise was complete, it now isn't
			if (this.get("completed")) { this.set({ completed: false }); }
			this.deselectEqRuleAndNode();
		}
	},

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
		json.current = false;
		json.currentlySelectedSteps = false;
		json.currentlySelectedStep = false;
		json.currentlySelectedNode = false;
		json.currentlySelectedEqRule = false;
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
		this.inputSetView.bind("symbolClick", this.onNodeSelected, this);
		this.goalSetView.bind("symbolClick", this.onNodeSelected, this);

		// Bind to the event the Exercise triggers when the user tries to apply an eq rule
		// that isn't applicable to the selected node.
		this.model.bind("alertEqRuleNotApplicable", this.onEqRuleNotApplicable, this);

		// Bind to the Exercise's completed member changing.
		this.model.bind("change:completed", this.onChangeCompleted, this);

		// Bind to the Exercise's undo and unstack availablity members changing.
		this.model.bind("change:undoAvailable", this.onChangeUndoAvailable, this);
		this.model.bind("change:unstackAvailable", this.onChangeUnstackAvailable, this);

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
			"exercise" : this.model.get("exerciseString"),
			"no" : this.model.get("no")
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
		this.$exerciseView = $("#exercise-view");
		this.currentExercise = false;
		this.currentExerciseView = false;
	},

	render : function () {
		var self = this;

		this.collection.each(function (exercise) {
			var exLiView = new App.ExerciseListItemView({
					model : exercise,
					collection : self
				});

			exLiView.bind("exClicked", self.onExClicked, self);
			self.$el.append(exLiView.render().el);
		});

		return this;
	},

	onAdd : function () {
		this.$el.empty();
		this.render();

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

			exercise.set({ current: true });
			this.currentExercise = exercise;
			this.currentExerciseView = new App.ExerciseView({
				model: this.currentExercise
			});
			this.$exerciseView.html(this.currentExerciseView.render().$el);
		}
	}
});

App.ExerciseManager = Backbone.Model.extend({

	defaults: {
		exerciseNumber: 1
	},

	initialize: function () {
		App.vent.on("userLoggedIn", this.onUserLoggedIn, this);
		App.vent.on("userLoggingOut", this.onUserLoggingOut, this);
	},

	getNewExercise: function () {
		var newExerciseView = new App.NewExerciseView({});
		newExerciseView.render();
	},

	addNewExercise: function (newExStartWff, newExFinishWff) {
		// TODO: Herein lies the issue.
		this.get("exercises").add({
			inputSet: new App.Steps([{
				node: newExStartWff,
				rule: "Start Wff"
			}]),

			goalSet: new App.Steps([{
				node: newExFinishWff,
				rule: "Finish Wff"
			}]),
			// override the default of false for testing
			no: this.get("exerciseNumber")
		});

		// Add one to the exercise number ready for the next task
		this.set("exerciseNumber", this.get("exerciseNumber") + 1);
	},

	onUserLoggedIn : function () {
		var self = this,
			unsavedEqRules = this.get("exercises").rest(35);

		// Save all the exercises done before the login to the user
		// To add them to the user that logged in
		this.get("exercises").each( function(ex) {
			ex.save();
		});

		$.ajax({
			
			url : 'api/userExercises',
			type : "GET",
			contentType : "application/json",
			dataType : "json",

			processData : false,

			success : function (data) {
				if (!data.error) {
					_.each(data.exercises, function (ex) {
						ex = App.Exercise.parse(ex);
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

	}
});