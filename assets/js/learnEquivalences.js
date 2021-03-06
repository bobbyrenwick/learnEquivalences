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

// An algorithm for converting an integer to roman numerals
App.toRomanNumerals = function (num) {
	var lookup = { m : 1000, cm : 900, d : 500, cd : 400, c : 100, xc : 90, l : 50, xl : 40, x : 10, ix : 9, v : 5, iv : 4, i : 1 },
		roman = "",
		i;
	
	if (num) {
		for ( i in lookup ) {
			while ( num >= lookup[i] ) {
				roman += i;
				num -= lookup[i];
			}
		}
		return roman;
	} else return null;
}

/**
 * Returns a random integer between min and max
 * Using Math.round() will give you a non-uniform distribution!
 */
App.getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

App.hasLowerCase = function (str) {
    return str.toUpperCase() != str;
}


/*
	Returns the power set of the set held in the array.
	Optionally doesn't return the empty set.
*/
App.powerset = function (ary) {
    var ps = [[]];
    for (var i=0; i < ary.length; i++) {
        for (var j = 0, len = ps.length; j < len; j++) {
            ps.push(ps[j].concat(ary[i]));
        }
    }
    return ps;
}

App.init = function () {

	// Setup the equivalence rule view
	var eqRulesView = new App.EquivalenceRulesView({
			collection: App.equivalenceRules,
			el: document.getElementById("eqRulesList")
		}),
	
		router = new App.LearnEqRouter(),

		$mainAppRow = $("#mainAppRow"),
		$treeVisView = $("#treeVisView"),
		mainAppHeight = $mainAppRow.height() / 2,
		treeVisViewWidth = $treeVisView.width(),

		resizeTimeout,

		resizer = function () {
			var mainAppPosY = $mainAppRow.offset().top,
				windowHeight = $(window).innerHeight(),
				newMainAppHeight = windowHeight - mainAppPosY - 20;

			$mainAppRow.height(newMainAppHeight);

			App.inputSetTreeVis.resizeSvg($treeVisView.width(), (newMainAppHeight - 53)/2);
			App.goalSetTreeVis.resizeSvg($treeVisView.width(), (newMainAppHeight - 53)/2);
			
		};
		
	App.exercisesListView = new App.ExercisesListView({
		collection: App.exerciseManager.get("exercises"),
		el: document.getElementById("exercisesListView")
	});

	App.userManager = new App.UserManager();

	// Create a singleton UserManager
	// Must be after the eqRulesView and ExercisesView have been created
	// So that if a user has a session then those can recieve the event
	// To tell them that the user is logged in. 
	App.userManagerView = new App.UserManagerView({
		el : document.getElementById("userManagerView"),
		model : App.userManager
	});

	App.inputSetTreeVis = new App.TreeVis({}, "inputSet", treeVisViewWidth, mainAppHeight);
	App.goalSetTreeVis = new App.TreeVis({}, "goalSet", treeVisViewWidth, mainAppHeight);

	eqRulesView.render();

	// Ensures that the first input box is focused when the new exercise modal is shown
	$("#newExerciseModal, #writeNextStepModal, #newEqRuleModal").on("shown", function () {
		$(this).find("input").eq(0).focus();
	});

	$("#newExerciseBtn").on("click", function (e) {
		e.stopPropagation();
		e.preventDefault();
		App.exerciseManager.getNewExercise();
	});

	$(window).unload(function () {
		if (App.userManager.isLoggedIn()) { // If the user is logged int
			// Save the state of the current exercise
			// eqRulesView.onUserLoggingOut();
			// App.exerciseManager.getCurrentExercise().save({}, { async : false });
			App.vent.trigger("userLoggingOut", { async : false });
		}
	});

	$(window).resize(resizer);

	resizer();

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