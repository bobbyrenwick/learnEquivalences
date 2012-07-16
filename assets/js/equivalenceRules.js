var App = App || {};

App.EquivalenceRule = Backbone.Model.extend({
	defaults: {
		active: false
	},

	url : "api/eqRule",

	// MongoDB's idAttribute is _id
	idAttribute: "_id",

	initialize: function () {
		if (this.get("fwdIntroSymbols") === undefined) {
			var introSymbols = App.EquivalenceRule.getIntroSymbols(this.get("lhsTrees")[0], this.get("rhsTrees")[0]);
			// Create the list of introSymbols 
			this.set({
				fwdIntroSymbols: introSymbols[0],
				bwdIntroSymbols: introSymbols[1]
			});
		}

		if (this.get("category")[0] === "U" && this.get("username") === undefined) { // Then we are dealing with a user defined eqRule that hasn't been saved
			// Set the textual representation of the new rule
			this.set({
				rule: this.get("lhsTrees")[0].toString() + " ≡ " + this.get("rhsTrees")[0].toString(),
			});

			// Create all the commutative versions needed for rule checking
			this.createCommutativeVersions();
		}
	},

	createCommutativeVersions: function () {
		var oldSideLength, startFrom, newSideLength, sides = ["lhsTrees", "rhsTrees"],
			self = this;

		// This calls the createCommutativeVersionsRecursive on
		_.each(sides, function (side) {
			// reset so that each side has the correct initial start from.
			oldSideLength = null;
			do {
				// If first time, start from 0 through 1 else start from oldLength
				startFrom = oldSideLength || 0;
				oldSideLength = self.get(side).length;

				for (i = startFrom; i < oldSideLength; i++) {
					self.createCommutativeVersionsIterative(side, self.get(side)[i]);
				}

				newSideLength = self.get(side).length;

			} while (newSideLength > oldSideLength);
		});
	},

	createCommutativeVersionsIterative: function (side, wholeTree) {
		var commutativeAnd = App.equivalenceRules.at(0),
			commutativeOr = App.equivalenceRules.at(6),
			commutativeAndPairs, commutativeOrPairs, commutativeDimplyPairs, subFormulae = [],
			self = this;

		// get all SubFormulae, try and do the commutative rule to them, it it works, add the resulting tree
		wholeTree.getSubFormulae(subFormulae);

		_.each(subFormulae, function (subF) {
			commutativeAndPairs = commutativeAnd.isApplicable(1, subF);
			commutativeOrPairs = commutativeOr.isApplicable(1, subF);
			commutativeDimplyPairs = App.commutativeDimply.isApplicable(1, subF);

			if (commutativeAndPairs) {
				self.addNewTreeToSide(commutativeAnd.applyRule(1, commutativeAndPairs, subF, wholeTree), side);
			} else if (commutativeOrPairs) {
				self.addNewTreeToSide(commutativeOr.applyRule(1, commutativeOrPairs, subF, wholeTree), side);
			} else if (commutativeDimplyPairs) {
				self.addNewTreeToSide(commutativeDimply.applyRule(1, commutativeDimplyPairs, subF, wholeTree), side);
			}
		});

	},

	// Checks if the newTree already exists within side and adds it if it doesn't
	addNewTreeToSide: function (newTree, side) {
		var trees = this.get(side),
			noTrees = trees.length,
			i, newTreeString = newTree.toString();

		for (i = 0; i < noTrees; i++) {
			if (newTreeString === trees[i].toString()) {
				return false; // Already in trees
			}
		}
		trees.push(newTree);
	},

	// Tests whether the equivalence rule is applicable to the supplied formula, goes through all the
	// different commutative permutations of the rule in the direction supplied -1 for backwards,
	// 1 for forwards
	isApplicable: function (direction, formula) {
		var i, trees = (direction < 0 ? this.get("rhsTrees") : this.get("lhsTrees")),
			noTrees = trees.length,
			applicable = false,
			matchingPairs;

		for (i = 0; i < noTrees; i++) {
			matchingPairs = [];
			if (App.EquivalenceRule.formulaMatchesTree(formula, trees[i], matchingPairs)) {
				// We have found a rule that is applicable, so return the matching pairs and
				return matchingPairs;
			}
		}
		// If it never matched any of the lhs trees then return false
		return false;
	},

	// Applys the rule to the subToReplace and replaces it within the whole formula
	// direction - > 0 for fwds, < 0 for bwds
	// matchingPairs - [ruleSymbol, subFormulae] pairs from EquivalenceRule.formulaMatchesTree()
	//                 returns a new tree that puts matchingPairs into a copy of the first of 
	//				   rhs(lhs)Trees for fwd(bwd).
	// subToReplace - reference to the subformula that needs to be replaced
	// whole - the entire formula contained within a step.
	// (tNo) - used to iterate through all the possible trees that could come from application (default = 0)
	applyRule: function (direction, matchingPairs, subToReplace, whole, tNo) {
		var treeNo = tNo || 0,
			tree = (direction < 0 ? this.get("lhsTrees")[treeNo].deepClone() : this.get("rhsTrees")[treeNo].deepClone()),
			subToReplaceWith = App.EquivalenceRule.replaceSubsInTree(tree, matchingPairs);

		return whole.deepCloneReplace(subToReplace, subToReplaceWith);
	},

	// Override so that the lhs and rhsTrees are saved as strings on the database.
	toJSON : function () {
		var json = _.clone(this.attributes);

		json.lhsTrees = _.map(json.lhsTrees, function(t) { return t.toString(); });
		json.rhsTrees = _.map(json.rhsTrees, function(t) { return t.toString(); });
		return json;
	},

	parse : function (response) {
		return App.EquivalenceRule.parse(response);
	}
	
}, {

	parse : function (eqRuleJSON) {
		eqRuleJSON.lhsTrees = _.map(eqRuleJSON.lhsTrees, function (t) { return App.parser.parse(t); });
		eqRuleJSON.rhsTrees = _.map(eqRuleJSON.rhsTrees, function (t) { return App.parser.parse(t); });
		return eqRuleJSON;				
	},

	
	// formula - contains the formula currently being matched
	// tree - the tree representation of the eq rule that is being matched against
	// matchingPairs - [rule symbol, sub-formula] pairs that have been matched so far
	//                 This allows cases where the rule contains the same symbol more than 
	//				   once and so should be matched to the same sub-formula
	formulaMatchesTree: function (formula, tree, matchingPairs) {
		var i, noPairs = matchingPairs.length,
			treeInPair = false;

		if (tree instanceof App.BinaryNode) {
			// the the top level structure of the tree is the same keep matching
			if (formula instanceof App.BinaryNode && formula.get("symbol") === tree.get("symbol")) {
				// match recursively the left and right, if either returns false, then whole function should return false
				if (!App.EquivalenceRule.formulaMatchesTree(formula.get("left"), tree.get("left"), matchingPairs)) {
					return false;
				}
				if (!App.EquivalenceRule.formulaMatchesTree(formula.get("right"), tree.get("right"), matchingPairs)) {
					return false;
				}
			} else {
				return false;
			}
		} else if (tree instanceof App.UnaryNode) {
			// match recursively right, if it returns false, then whole function should return false
			if (formula instanceof App.UnaryNode && formula.get("symbol") === tree.get("symbol")) {
				if (!App.EquivalenceRule.formulaMatchesTree(formula.get("right"), tree.get("right"), matchingPairs)) {
					return false;
				}
			} else {
				return false;
			}
		} else if (tree instanceof App.Tautology) {
			// As long as the formula is also a tautology this is fine but it shouldn't be added to the matching pairs
			if (formula instanceof App.Tautology) {
				return true;
			}
			return false;
		} else if (tree instanceof App.Contradiction) {
			// As long as the formula is also a contradiction this is fine but it shouldn't be added to the matching pairs
			if (formula instanceof App.Contradiction) {
				return true;
			}
			return false;
		} else {
			// Reached an atom - go through the matching [ruleSymbol, subFormula] pairs. If the symbol
			// has already been matched to a sub formula - formula needs to be the same as the previously 
			// matched sub formula.
			// If not already matched just store new [ruleSymbol, subFormula] pair
			for (i = 0; i < noPairs; i++) {
				if (matchingPairs[i][0].toString() === tree.toString()) {
					if (matchingPairs[i][1].toString() !== formula.toString()) {
						return false;
					} else { // the matching pair found this time is the same as the other times it has been found.
						return true;
					}
				}
			}

			matchingPairs.push([tree, formula]);
			return true;
		}
		return true;
	},

	// tree is a copy of the tree representation of the other side of an equivalence rule that has been chosen
	// matchingPairs contains [rule symbol, sub-formula] pairs - need to deepClone the sub-formula parts of these
	// to ensure we have new objects rather than references to the old ones
	replaceSubsInTree: function (tree, matchedPairs) {
		var i, noPairs = matchedPairs.length,
			atomInPairs = false;

		// Keep going till we hit a node
		if (tree instanceof App.BinaryNode) {
			tree.set({
				"left": App.EquivalenceRule.replaceSubsInTree(tree.get("left"), matchedPairs)
			});
			tree.set({
				"right": App.EquivalenceRule.replaceSubsInTree(tree.get("right"), matchedPairs)
			});
		} else if (tree instanceof App.UnaryNode) {
			tree.set({
				"right": App.EquivalenceRule.replaceSubsInTree(tree.get("right"), matchedPairs)
			});
		} else { // We have found an atom
			// Try to find the atom in matchedPairs
			for (i = 0; i < noPairs; i++) {
				// The atom has been found in the list so replace this leaf with a copy of the sub-formula
				if (matchedPairs[i][0].toString() === tree.toString()) {
					return matchedPairs[i][1].deepClone();
				}
			}

			return tree;
		}
		return tree;
	},

	// Returns an array of the symbols within tree that aren't present in tree2
	// Used for generating b(f)wdIntroSymbols during equivalenceRule initialise.
	// lhsTrees[0], rhsTrees[0]
	// In turn used for creating an introduction modal.
	// E.G for backwards application of A → A ≡ ⊤, would return ["A"]
	getIntroSymbols: function (tree, tree2) {
		var treeAtoms = [],
			treeSymbols, tree2Atoms = [],
			tree2Symbols;

		tree.getAtoms(treeAtoms);
		treeSymbols = _.pluck(treeAtoms, "symbol");

		tree2.getAtoms(tree2Atoms);
		tree2Symbols = _.pluck(tree2Atoms, "symbol");

		return [
		_.difference(tree2Symbols, treeSymbols), // fwdIntroSymbols
		_.difference(treeSymbols, tree2Symbols) // bwdIntroSymbols
		];
	},

	// Takes an oldWff and a new Wff and works out if there is an equivalence
	// rule that has been applied to the oldWff to result in the newWff
	findEqRuleApplied: function (oldWff, newWff) {
		var oldWffSubs = [],
			oldWffSubsLength, newWffSubs = [],
			newWffSubsLength, i, self = this,
			newWffString = newWff.toString(),
			testWff, matchingPairs, noPossibleTrees, j, k, introMatchingPairs, iEq, noEqRules = App.equivalenceRules.length,
			eqRule;

		// Get the sub formulae from the oldWff
		oldWff.getSubFormulae(oldWffSubs);
		oldWffSubsLength = oldWffSubs.length;

		newWff.getSubFormulae(newWffSubs);
		newWffSubsLength = newWffSubs.length;

		// For each of the sub-formulae in the old wff, for each of the rules that are applicable
		// apply the rule and then get a new whole 
		// formula, and see if the new whole formula is equal to the new wff - if this is the case
		// we have the rule that's been applied and the direction so return that.
		for (i = 0; i < oldWffSubsLength; i++) { // For every subF of the oldWff
			for (iEq = 0; iEq < noEqRules; iEq++) {
				eqRule = App.equivalenceRules.at(iEq);
				matchingPairs = eqRule.isApplicable(1, oldWffSubs[i]);

				if (matchingPairs) { // If the rule is applicable forwards
					if (eqRule.get("fwdIntroSymbols").length >= 0) { // i.e the fwd application of rule may/ may not require introduction
						for (j = 0; j < newWffSubsLength; j++) { // For all the newWff subFs
							introMatchingPairs = eqRule.isApplicable(-1, newWffSubs[j]);
							if (introMatchingPairs) { // If the eqRule is applicable backwards to the newWff subF
								for (k = 0, noPossibleTrees = eqRule.get("lhsTrees").length; k < noPossibleTrees; k++) {
									if (eqRule.applyRule(-1, introMatchingPairs, newWffSubs[j], newWff, k).toString() === oldWff.toString()) {
										return { // If the application of the eqRule to the 
											"rule": eqRule,
											"direction": 1
										};
									}
								}
							}
						}
					}
				}

				if (eqRule.get("bidirectional")) {
					matchingPairs = eqRule.isApplicable(-1, oldWffSubs[i]);
					if (matchingPairs) { // Then the equivalence rule is applicable to the current oldWff subF
						if (eqRule.get("bwdIntroSymbols").length >= 0) { // i.e the bwd application of rule may/ may not require introduction
							for (j = 0; j < newWffSubsLength; j++) { // For all the newWff subFs
								introMatchingPairs = eqRule.isApplicable(1, newWffSubs[j]);
								if (introMatchingPairs) { // If the eqRule is applicable to the newWff subF
									for (k = 0, noPossibleTrees = eqRule.get("rhsTrees").length; k < noPossibleTrees; k++) {
										if (eqRule.applyRule(1, introMatchingPairs, newWffSubs[j], newWff, k).toString() === oldWff.toString()) {
											return { // If the application of the eqRule to the 
												"rule": eqRule,
												"direction": -1
											};
										}
									}
								}
							}
						}
					}
				}
			} //end of equivalencerule each
		}

		return false;
	}
});

App.EquivalenceRules = Backbone.Collection.extend({
	model: App.EquivalenceRule
});

App.EquivalenceRuleView = Backbone.View.extend({
	tagName: "li",
	className: "equivalenceRule",
	template: _.template($("#equivalenceRuleTemplate").html()),

	events: {
		"click *": "onEqRuleClick"
	},

	initialize: function () {
		this.model.bind("change:active", this.onActiveChange, this);
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON());
		this.$el.html(renderedContent);
		return this;
	},

	onEqRuleClick: function (e) {
		// Stop the URL changing and event bubbling
		e.preventDefault();
		e.stopPropagation();
		// Tell the current exercise that the selected equivalence rule
		// has changed.
		App.vent.trigger("currentlySelectedEqRuleChange", this.model);
	},

	// Adds or removes the active class dependent on the data
	onActiveChange: function () {
		if (this.model.get("active")) {
			this.$el.addClass("active");
		} else {
			this.$el.removeClass("active");
		}
	}
});

App.EquivalenceRulesView = Backbone.View.extend({

	events: {
		"click #newEqRuleBtn": "createNewEqRuleModal"
	},

	initialize: function () {
		this.collection.on("add", this.renderEqRule, this);
		this.collection.on("remove", this.removeEqRule, this);

		// Bind to Users Logging In
		App.vent.bind("userLoggedIn", this.onUserLoggedIn, this);

		// Bind to users about to log out - save all eq rules.
		App.vent.bind("userLoggingOut", this.onUserLoggingOut, this);

		// An array to hold EquivalenceRuleViews
		this.eqRuleViews = [];
	},

	render: function () {
		this.collection.each(this.renderEqRule, this);
		return this;
	},

	createNewEqRuleModal: function () {
		var newEqRuleView = new App.NewEqRuleModalView({
			model: new App.NewEqRuleModal({
				"collection": this.collection
			})
		});

		newEqRuleView.render();
	},

	renderEqRule: function (eqRule) {
		var view = new App.EquivalenceRuleView({
			model: eqRule,
			collection: this.collection
		}),
			header = this.$("li.nav-header:contains('" + eqRule.get("category") + "')");

		if (eqRule.get("category")[0] !== "U") { // Then this isn't a user equivalence add as normal
			if (header.length === 0) {
				$("<li class=\"nav-header\">" + eqRule.get("category") + "</li>").appendTo(this.$el).on("click", function () {
					$(this).nextUntil("li.nav-header").slideToggle();
				});
			}
			this.$el.append(view.render().el);

		} else { // Add at the top
			if (header.length === 0) {
				$("<li class=\"nav-header\">" + eqRule.get("category") + "</li>").insertAfter(this.$("#newEqRuleBtn")).on("click", function () {
					$(this).nextUntil("li.nav-header").slideToggle();
				});
			}
			this.$("li.nav-header").eq(2).before(view.render().el);
		}

		this.eqRuleViews.push(view);
	},

	onUserLoggedIn : function () {
		var self = this,
			unsavedEqRules = this.collection.rest(35);

		// Save all eq rules that were addded before login to this new user.
		_.each(unsavedEqRules, function(eqRule) {
			eqRule.save();
		})

		$.ajax({
			
			url : 'api/userEqRules',
			type : "GET",
			contentType : "application/json",
			dataType : "json",

			processData : false,

			success : function (data) {
				if (!data.error) {

					_.each(data.eqRules, function (eqRule) {
						eqRule = App.EquivalenceRule.parse(eqRule);
					});
					self.collection.add(data.eqRules);
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
		// Remove all eqRules from this.collection past the default rules
		this.collection.remove(this.collection.rest(35));
	},

	removeEqRule : function (eqRule) {
		// As only ever used to remove user eqs, reduce the search size.
		var userEqRuleViews = _.rest(this.eqRuleViews,35),
			noUserEqRuleViews = userEqRuleViews.length,
			i;

		for (i = 0; i < noUserEqRuleViews; i++) {
			if (userEqRuleViews[i].model === eqRule) {
				userEqRuleViews[i].remove(); // Remove the userEqRule from the DOM
				this.eqRuleViews.splice(35 + i ,1) // Remove the userEqRule from the array
				if (userEqRuleViews.length === 1) { // Then we are removing the last user eqRule, so remove the header too.
					this.$(".nav-header").eq(1).remove();
				}
			}
		}
	}
});

// A commutative double implication rule - purely for creating the commutative versions of
// user inputted equivalence rules. Not a default rule - not in equivalenceRules
App.commutativeDimply = new App.EquivalenceRule({
	rule: "A ↔ B ≡ B ↔ A",
	bidirectional: false,
	category: "Equivalences Involving ↔",

	lhsTrees: [
	new App.DimplyNode({
		left: new App.Node({
			symbol: "A"
		}),
		right: new App.Node({
			symbol: "B"
		})
	})],

	rhsTrees: [
	new App.DimplyNode({
		left: new App.Node({
			symbol: "B"
		}),
		right: new App.Node({
			symbol: "A"
		})
	})]

});

// All the default equivalence rules.
App.equivalenceRules = new App.EquivalenceRules([
	{
		rule: "A ∧ B ≡ B ∧ A",
		bidirectional: false,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})]
	}, {

		rule: "A ∧ A ≡ A",
		bidirectional: true,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [ // i.e applicable all the time
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "A ∧ ⊤ ≡ A",
		bidirectional: true,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Tautology()
		}), new App.AndNode({
			left: new App.Tautology(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [ // i.e applicable all the time
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "A ∧ ⊥ ≡ ⊥",
		bidirectional: true,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Contradiction()
		}), new App.AndNode({
			left: new App.Contradiction(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Contradiction()]

	}, {
		rule: "¬A ∧ A ≡ ⊥",
		bidirectional: true,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		}), new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.Contradiction()]

	}, {
		rule: "(A ∧ B) ∧ C ≡ A ∧ (B ∧ C)",
		bidirectional: true,
		category: "Equivalences Involving ∧",

		lhsTrees: [
		new App.AndNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "C"
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		})]

	}, { // Equivalences involving or
		rule: "A ∨ B ≡ B ∨ A",
		bidirectional: false,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})]

	}, {
		rule: "A ∨ A ≡ A",
		bidirectional: true,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "A ∨ ⊤ ≡ ⊤",
		bidirectional: true,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Tautology()
		}), new App.OrNode({
			left: new App.Tautology(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "¬A ∨ A ≡ ⊤",
		bidirectional: true,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		}), new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "A ∨ ⊥ ≡ A",
		bidirectional: true,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Contradiction()
		}), new App.OrNode({
			left: new App.Contradiction(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [ // i.e always applicable
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "(A ∨ B) ∨ C ≡ A ∨ (B ∨ C)",
		bidirectional: true,
		category: "Equivalences Involving ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "C"
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		})]

	}, {
		rule: "¬⊤ ≡ ⊥",
		bidirectional: true,
		category: "Equivalences Involving ¬",

		lhsTrees: [
		new App.NegationNode({
			right: new App.Tautology()
		})],

		rhsTrees: [
		new App.Contradiction()]

	}, {
		rule: "¬⊥ ≡ ⊤",
		bidirectional: true,
		category: "Equivalences Involving ¬",

		lhsTrees: [
		new App.NegationNode({
			right: new App.Contradiction()
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "¬¬A ≡ A",
		bidirectional: true,
		category: "Equivalences Involving ¬",

		lhsTrees: [
		new App.NegationNode({
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "A → A ≡ ⊤",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "⊤ → A ≡ A",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Tautology(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]

	}, {
		rule: "A → ⊤ ≡ ⊤",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Tautology()
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "⊥ → A ≡ ⊤",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Contradiction(),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Tautology()]

	}, {
		rule: "A → ⊥ ≡ ¬A",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Contradiction()
		})],

		rhsTrees: [
		new App.NegationNode({
			right: new App.Node({
				symbol: "A"
			})
		})]

	}, {
		rule: "A → B ≡ ¬A ∨ B",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "B"
			})
		}), new App.OrNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})

		]

	}, {
		rule: "A → B ≡ ¬(A ∧ ¬B)",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.ImplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		})],

		rhsTrees: [
		new App.NegationNode({
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			})
		}), new App.NegationNode({
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "¬(A → B) ≡ A ∧ ¬B",
		bidirectional: true,
		category: "Equivalences involving →",

		lhsTrees: [
		new App.NegationNode({
			right: new App.ImplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			})
		}),

		new App.AndNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})]

	}, {
		rule: "A ↔ B ≡ (A → B) ∧ (B → A)",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.DimplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		}), new App.DimplyNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.ImplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.ImplyNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.AndNode({
			left: new App.ImplyNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.ImplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		})]

	}, {
		rule: "A ↔ B ≡ (A ∧ B) ∨ (¬A ∧ ¬B)",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.DimplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		}), new App.DimplyNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.OrNode({ // (A ∧ B) ∨ (¬A ∧ ¬B)
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			})
		}), new App.OrNode({ // (B ∧ A) ∨ (¬A ∧ ¬B)
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			})
		}), new App.OrNode({ // (A ∧ B) ∨ (¬B ∧ ¬A)
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				})
			})
		}), new App.OrNode({ // (B ∧ A) ∨ (¬B ∧ ¬A)
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				})
			})
		}), new App.OrNode({ // (¬A ∧ ¬B) ∨ (A ∧ B)
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.OrNode({ // (¬B ∧ ¬A) ∨ (A ∧ B)
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.OrNode({ // (¬A ∧ ¬B) ∨ (B ∧ A)
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.OrNode({ // (¬B ∧ ¬A) ∨ (B ∧ A)
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "A ↔ B ≡ ¬A ↔ ¬B",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.DimplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.Node({
				symbol: "B"
			})
		}), new App.DimplyNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.DimplyNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.DimplyNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "¬(A ↔ B) ≡ A ↔ ¬B",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.NegationNode({
			right: new App.DimplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.NegationNode({
			right: new App.DimplyNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.DimplyNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.DimplyNode({
			left: new App.Node({
				symbol: "B"
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "¬(A ↔ B) ≡ ¬A ↔ B",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.NegationNode({
			right: new App.DimplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.NegationNode({
			right: new App.DimplyNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.DimplyNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "B"
			})
		}), new App.DimplyNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})]

	}, {
		rule: "¬(A ↔ B) ≡ (A ∧ ¬B) ∨ (¬A ∧ B)",
		bidirectional: true,
		category: "Equivalences involving ↔",

		lhsTrees: [
		new App.NegationNode({
			right: new App.DimplyNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.AndNode({
				left: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "B"
					})
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.NegationNode({
					right: new App.Node({
						symbol: "A"
					})
				})
			})
		})]

	}, {
		rule: "¬(A ∧ B) ≡ ¬A ∨ ¬B",
		bidirectional: true,
		category: "De Morgan's laws",

		lhsTrees: [
		new App.NegationNode({
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			})
		})]

	}, {
		rule: "¬(A ∨ B) ≡ ¬A ∧ ¬B",
		bidirectional: true,
		category: "De Morgan's laws",

		lhsTrees: [
		new App.NegationNode({
			right: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "B"
				})
			})
		})]

	}, {
		rule: "A ∧ (B ∨ C) ≡ (A ∧ B) ∨ (A ∧ C)",
		bidirectional: true,
		category: "Distributivity of ∧, ∨",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}),
		// don't need one that flips the outer sides around because
		// A and C will take anything, just do all inner swap permutations
		new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "C"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "C"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "A ∨ (B ∧ C) ≡ (A ∨ B) ∧ (A ∨ C)",
		bidirectional: true,
		category: "Distributivity of ∧, ∨",

		lhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "C"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}),
		// don't need one that flips the outer sides around because
		// A and C will take anything, just do all inner swap permutations
		new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "C"
				})
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "C"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "C"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		})]

	}, {
		rule: "A ∧ (A ∨ B) ≡ A ∨ (A ∧ B)",
		bidirectional: true,
		category: "Distributivity of ∧, ∨",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.OrNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		}), new App.OrNode({
			left: new App.AndNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})]

	}, {
		rule: "A ∧ (A ∨ B) ≡ A",
		bidirectional: true,
		category: "Distributivity of ∧, ∨",

		lhsTrees: [
		new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			})
		}), new App.AndNode({
			left: new App.Node({
				symbol: "A"
			}),
			right: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "A"
				}),
				right: new App.Node({
					symbol: "B"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		}), new App.AndNode({
			left: new App.OrNode({
				left: new App.Node({
					symbol: "B"
				}),
				right: new App.Node({
					symbol: "A"
				})
			}),
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]
	}
]);