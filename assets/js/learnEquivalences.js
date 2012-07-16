/*global Backbone: false, jQuery: false*/
/*jslint browser: true, devel: true, nomen: true, plusplus: true, sloppy: true */

var App = App || {};
App.vent = _.extend({}, Backbone.Events);

App.LearnEqRouter = Backbone.Router.extend({
	routes: {
		'*path': 'home'
	},

	initialize: function () {

	},

	home: function () {
		// Do nothing
	}

});

// Create an app-wide exerciseManager so that modal's can add an exercise
App.exerciseManager = new App.ExerciseManager({
	// Give the exerciseManager a blank Exercises collection
	exercises: new App.Exercises()
});

App.init = function () {

	// Ensures that the first input box is focused when the new exercise modal is shown
	$("#newExerciseModal, #writeNextStepModal, #newEqRuleModal").on("shown", function () {
		$(this).find("input").eq(0).focus();
	});

	$("#newExerciseBtn").on("click", function () {
		App.exerciseManager.getNewExercise();
	});

	$(window).resize(function () {

	});

	// Setup the equivalence rule view
	var eqRulesView = new App.EquivalenceRulesView({
		collection: App.equivalenceRules,
		el: document.getElementById("equivalence-rules-list")
	}),
	
	router = new App.LearnEqRouter(),
	exercisesListView = new App.ExercisesListView({
			collection: App.exerciseManager.get("exercises"),
			el: document.getElementById("exercisesListView")
	});

	// Create a singleton UserManager
	// Must be after the eqRulesView and ExercisesView have been created
	// So that if a user has a session then those can recieve the event
	// To tell them that the user is logged in. 
	App.userManagerView = new App.UserManagerView({
		el : document.getElementById("userManagerView"),
		model : new App.UserManager()
	});

	eqRulesView.render();

	// Ask the user for an exercise
	//App.exerciseManager.getNewExercise();



	/* TODO: Work out if this is necessary */
	Backbone.history.start({
		pushState: true
	});
};

// Defines the getCursorPosition and setCursorPosition jQuery plugins.
(function ($) {
	$.fn.getCursorPosition = function () {
		var input = this.get(0),
			sel, selLen;
		if (!input) {
			return;
		} // No (input) element found
		if ('selectionStart' in input) {
			// Standard-compliant browsers
			return input.selectionStart;
		} else if (document.selection) {
			// IE
			input.focus();
			sel = document.selection.createRange();
			selLen = document.selection.createRange().text.length;
			sel.moveStart('character', -input.value.length);
			return sel.text.length - selLen;
		}
	};

	$.fn.setCursorPosition = function (pos) {
		var range;
		if ($(this).get(0).setSelectionRange) {
			$(this).get(0).setSelectionRange(pos, pos);
		} else if ($(this).get(0).createTextRange) {
			range = $(this).get(0).createTextRange();
			range.collapse(true);
			range.moveEnd('character', pos);
			range.moveStart('character', pos);
			range.select();
		}
	};
}(jQuery));

// Run app on DOMReady
jQuery(function () {
	App.init();
});