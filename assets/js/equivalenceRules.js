var App = App || {};

App.EquivalenceRule = Backbone.Model.extend({
	defaults: {
		active: false,
		freeVarCheck: false
	},

	url : "api/eqRule",

	// MongoDB's idAttrAttrAttribute is _id
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

	alwaysApplicable : function (dir) {
		var tree = (dir > 0 ? this.get("lhsTrees")[0] : this.get("rhsTrees")[0]),
			symbol = tree.get("symbol");

		return /^[A-Z]$/.test(symbol);
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
	isApplicable : function (direction, formula) {
		var i, trees = (direction < 0 ? this.get("rhsTrees") : this.get("lhsTrees")),
			noTrees = trees.length,
			applicable = false,
			matchingPairs;

		for (i = 0; i < noTrees; i++) {
			
			matchingPairs = {
				atomPairs : [],
				quantifierPairs : []
			};
			
			if (App.EquivalenceRule.formulaMatchesTree(formula, trees[i], matchingPairs)) {
				// We have found a rule that is applicable, so if needed, check any variables don't occur free.
				if (!this.get("freeVarCheck") || this.passesFreeVarTest(formula, matchingPairs)) {
					return matchingPairs;
				}
			}
		}
		// If it never matched any of the lhs trees then return false
		return false;
	},

	// Same as above but formula is normal - not a backbone model
	isApplicableQuick : function (direction, formula) {
		var i, trees = (direction < 0 ? this.get("rhsTrees") : this.get("lhsTrees")),
			noTrees = trees.length,
			applicable = false,
			matchingPairs;

		for (i = 0; i < noTrees; i++) {
			
			matchingPairs = {
				atomPairs : [],
				quantifierPairs : []
			};
			
			if (App.EquivalenceRule.formulaMatchesTreeQuick(formula, trees[i], matchingPairs)) {
				// We have found a rule that is applicable, so if needed, check any variables don't occur free.
				if (!this.get("freeVarCheck") || this.passesFreeVarTest(formula, matchingPairs)) {
					return matchingPairs;
				}
			}
		}
		// If it never matched any of the lhs trees then return false
		return false;
	},

	// Applys the rule to the subToReplace and replaces it within the whole formula - returns a new tree 
	// that puts matchingPairs into a copy of the first of rhs(lhs)Trees for fwd(bwd).
	// direction - > 0 for fwds, < 0 for bwds
	// matchingPairs - { atomPairs : [[ruleSymbol, subFormulae]], quantifierPairs : [[ruleSymbol, quantVar]] } 
	//                 from EquivalenceRule.formulaMatchesTree()
	// subToReplace - reference to the subformula that needs to be replaced
	// whole - the entire formula contained within a step.
	// (tNo) - used to iterate through all the possible trees that could come from application (default = 0)
	applyRule : function (direction, matchingPairs, subToReplace, whole, tNo) {
		var treeNo = tNo || 0,
			tree = (direction < 0 ? this.get("lhsTrees")[treeNo].deepClone() : this.get("rhsTrees")[treeNo].deepClone()),
			subToReplaceWith;

		subToReplace.set("selected", false);
		subToReplaceWith = App.EquivalenceRule.replaceSubsInTree(tree, matchingPairs);

		return whole.deepCloneReplace(subToReplace, subToReplaceWith);
	},

	applyRuleQuick : function (direction, matchingPairs, subToReplace, whole, tNo) {
		var treeNo = tNo || 0,
			tree = (direction < 0 ? this.get("lhsTrees")[treeNo].deepClone() : this.get("rhsTrees")[treeNo].deepClone()),
			tree = App.backboneToNormal(tree),
			subToReplaceWith;

		subToReplaceWith = App.EquivalenceRule.replaceSubsInTreeQuick(tree, matchingPairs);

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
	},


	// Given a formula and set of matching pairs, decides whether the formula,
	// passes the free var test.
	passesFreeVarTest : function (formula, matchingPairs) {
		var freeVarPairs = this.get("freeVarCheck"),
			quantVar,
			subFVar;

		// For now return true if no matching quantifiers - because freeVarCheck being
		// called on fwd and bwd. On bwd there are no matching quantifiers.
		if (matchingPairs.quantifierPairs.length === 0) { return true; }

		for (var i = 0, l = freeVarPairs.length; i < l; i++) {
			// Set quantvar to the var that shouldnt occur in subF, given in terms
			// of the rule.
			quantVar = freeVarPairs[i][0];
			subF = freeVarPairs[i][1];

			// Set quantvar to the variable that it matched to in formula
			quantVar = _.find(matchingPairs.quantifierPairs, function (p) {
				return p[0] === quantVar;
			})[1];

			// Find the subF of formula that matches the subF letter in the pair
			subF = _.find(matchingPairs.atomPairs, function (p) {
				return p[0].get("symbol") === subF;
			})[1];

			// Test to see if the variable occurs free in the subformula.
			if (App.EquivalenceRule.occursFree(quantVar, subF)) {
				return false;
			}
		}

		return true;
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
		var i, noAtomPairs = matchingPairs.atomPairs.length, noQuantifierPairs = matchingPairs.quantifierPairs.length;

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
				} else if (formula instanceof App.Quantifier) { // need to also check that the quantifier variable of the rule has matched
						
						for (i = 0; i < noQuantifierPairs; i++) {
							if (matchingPairs.quantifierPairs[i][0] === tree.get("variable")) {
								if (matchingPairs.quantifierPairs[i][1] !== formula.get("variable")) {
									return false;
								} else { // the matching pair found this time is the same as the other times it has been found.
									return true;
								}
							}
						}

						// If not already matched just store new [ruleSymbol, formulaQuantVariable] pair
						matchingPairs.quantifierPairs.push([tree.get("variable"), formula.get("variable")]);
						return true;
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
			for (i = 0; i < noAtomPairs; i++) {
				if (matchingPairs.atomPairs[i][0].toString() === tree.toString()) {
					if (matchingPairs.atomPairs[i][1].toString() !== formula.toString()) {
						return false;
					} else { // the matching pair found this time is the same as the other times it has been found.
						return true;
					}
				}
			}
			// If not already matched just store new [ruleSymbol, subFormula] pair
			matchingPairs.atomPairs.push([tree, formula]);
			return true;
		}
		return true;
	},

	// Same as above but formula is a normal js obj, not a backbone model
	formulaMatchesTreeQuick: function (formula, tree, matchingPairs) {
		var i, noAtomPairs = matchingPairs.atomPairs.length, noQuantifierPairs = matchingPairs.quantifierPairs.length;

		if (tree instanceof App.BinaryNode) {
			// the the top level structure of the tree is the same keep matching
			if (formula instanceof App.BinaryNodeNormal && formula.symbol === tree.attributes.symbol) {
				// match recursively the left and right, if either returns false, then whole function should return false
				if (!App.EquivalenceRule.formulaMatchesTreeQuick(formula.left, tree.attributes.left, matchingPairs)) {
					return false;
				}
				if (!App.EquivalenceRule.formulaMatchesTreeQuick(formula.right, tree.attributes.right, matchingPairs)) {
					return false;
				}
			} else {
				return false;
			}
		} else if (tree instanceof App.UnaryNode) {
			// match recursively right, if it returns false, then whole function should return false
			if (formula instanceof App.UnaryNodeNormal && formula.symbol === tree.attributes.symbol) {
				if (!App.EquivalenceRule.formulaMatchesTreeQuick(formula.right, tree.attributes.right, matchingPairs)) {
					return false;
				} else if (formula instanceof App.Quantifier) { // need to also check that the quantifier variable of the rule has matched
						
						for (i = 0; i < noQuantifierPairs; i++) {
							if (matchingPairs.quantifierPairs[i][0] === tree.attributes.variable) {
								if (matchingPairs.quantifierPairs[i][1] !== formula.variable) {
									return false;
								} else { // the matching pair found this time is the same as the other times it has been found.
									return true;
								}
							}
						}

						// If not already matched just store new [ruleSymbol, formulaQuantVariable] pair
						matchingPairs.quantifierPairs.push([tree.attributes.variable, formula.variable]);
						return true;
				}
			} else {
				return false;
			}
		} else if (tree instanceof App.Tautology) {
			// As long as the formula is also a tautology this is fine but it shouldn't be added to the matching pairs
			return formula instanceof App.TautologyNormal;
		} else if (tree instanceof App.Contradiction) {
			// As long as the formula is also a contradiction this is fine but it shouldn't be added to the matching pairs
			return formula instanceof App.ContradictionNormal;
		} else {
			// Reached an atom - go through the matching [ruleSymbol, subFormula] pairs. If the symbol
			// has already been matched to a sub formula - formula needs to be the same as the previously 
			// matched sub formula.
			for (i = 0; i < noAtomPairs; i++) {
				if (matchingPairs.atomPairs[i][0].toString() === tree.toString()) {
					if (matchingPairs.atomPairs[i][1].toString() !== formula.toString()) {
						return false;
					} else { // the matching pair found this time is the same as the other times it has been found.
						return true;
					}
				}
			}
			// If not already matched just store new [ruleSymbol, subFormula] pair
			matchingPairs.atomPairs.push([tree, formula]);
			return true;
		}
		return true;
	},

	// tree is a copy of the tree representation of the other side of an equivalence rule that has been chosen
	// matchingPairs contains [rule symbol, sub-formula] pairs - need to deepClone the sub-formula parts of these
	// to ensure we have new objects rather than references to the old ones
	replaceSubsInTree: function (tree, matchedPairs) {
		var i, noPairs = matchedPairs.atomPairs.length;

		// Keep going till we hit a node
		if (tree instanceof App.BinaryNode) {
			tree.set({
				"left": App.EquivalenceRule.replaceSubsInTree(tree.get("left"), matchedPairs),
				"right": App.EquivalenceRule.replaceSubsInTree(tree.get("right"), matchedPairs)
			});
		} else if (tree instanceof App.UnaryNode) {
			tree.set({
				"right": App.EquivalenceRule.replaceSubsInTree(tree.get("right"), matchedPairs)
			});

			if (tree instanceof App.Quantifier) {
				tree.set("variable", _.find(matchedPairs.quantifierPairs, function (pair) { return pair[0] === tree.get("variable") })[1])
			}
		} else { // We have found an atom
			// Try to find the atom in matchedPairs
			for (i = 0; i < noPairs; i++) {
				// The atom has been found in the list so replace this leaf with a copy of the sub-formula
				if (matchedPairs.atomPairs[i][0].toString() === tree.toString()) { // TODO: maybe replace this with matching trees.
					return matchedPairs.atomPairs[i][1].deepClone();
				}
			}

			return tree;
		}
		return tree;
	},

	// tree is a copy of the tree representation of the other side of an equivalence rule that has been chosen
	// matchingPairs contains [rule symbol, sub-formula] pairs - need to deepClone the sub-formula parts of these
	// to ensure we have new objects rather than references to the old ones
	replaceSubsInTreeQuick: function (tree, matchedPairs) {
		var i, noPairs = matchedPairs.atomPairs.length;

		// Keep going till we hit a node
		if (tree instanceof App.BinaryNodeNormal) {
			tree.left = App.EquivalenceRule.replaceSubsInTreeQuick(tree.left, matchedPairs);
			tree.right = App.EquivalenceRule.replaceSubsInTreeQuick(tree.right, matchedPairs);
		} else if (tree instanceof App.UnaryNodeNormal) {
			tree.right = App.EquivalenceRule.replaceSubsInTreeQuick(tree.right, matchedPairs);
			if (tree instanceof App.Quantifier) {
				tree.variable = _.find(matchedPairs.quantifierPairs, function (pair) { return pair[0] === tree.variable; })[1];
			}
		} else { // We have found an atom
			// Try to find the atom in matchedPairs
			for (i = 0; i < noPairs; i++) {
				// The atom has been found in the list so replace this leaf with a copy of the sub-formula
				if (matchedPairs.atomPairs[i][0].toString() === tree.toString()) { // TODO: maybe replace this with matching trees.
					return matchedPairs.atomPairs[i][1].deepClone();
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
		var treeAtoms = [], treeQuantVars,
			treeSymbols, tree2Atoms = [], tree2QuantVars,
			tree2Symbols, subF = [];

		// Get all the atoms in tree
		tree.getAtoms(treeAtoms);
		treeSymbols = _.pluck(treeAtoms, "symbol");

		// Get all the quantifier variables in tree
		tree.getSubFormulae(subF);
		treeQuantVars = _.chain(subF)
			.filter(function (sf) { return sf instanceof App.Quantifier; })
			.map(function (sf) { return sf.get("variable"); })
			.value();

		// Get all the atoms in tree 2
		tree2.getAtoms(tree2Atoms);
		tree2Symbols = _.pluck(tree2Atoms, "symbol");

		// Reset subF
		subF = [];

		// Get all the quantifier variables in tree
		tree2.getSubFormulae(subF);
		tree2QuantVars = _.chain(subF)
			.filter(function (sf) { return sf instanceof App.Quantifier; })
			.map(function (sf) { return sf.get("variable"); })
			.value();

		return [{ // fwdIntroSymbols
			symbols : _.difference(tree2Symbols, treeSymbols),
			quantifiers : _.difference(tree2QuantVars, treeQuantVars)
		}, { // bwdIntroSymbols
			symbols : _.difference(treeSymbols, tree2Symbols), 
			quantifiers : _.difference(treeQuantVars, tree2QuantVars)
		}];
	},

	// TODO: update for new introSymbols design - should be i = 1 when going through the backwards
	// stuff - check this whe we get into uni
	// Takes an oldWff and a new Wff and works out if there is an equivalence
	// rule that has been applied to the oldWff to result in the newWff
	findEqRuleApplied: function (oldWff, newWff) {
		var oldWffSubs = [],
			oldWffSubsLength, newWffSubs = [],
			newWffSubsLength, i, self = this,
			newWffString = newWff.toString(),
			testWff, matchingPairs, noPossibleTrees, j, k, introMatchingPairs, iEq, noEqRules = App.equivalenceRules.length,
			eqRule;

		console.log("findEqRuleApplied called");
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
					if (eqRule.get("fwdIntroSymbols").quantifiers.length + eqRule.get("fwdIntroSymbols").symbols.length > 0) { // i.e the fwd application requires introduction
						for (j = 0; j < newWffSubsLength; j++) { // For all the newWff subFs
							introMatchingPairs = eqRule.isApplicable(-1, newWffSubs[j]);
							if (introMatchingPairs) { // If the eqRule is applicable backwards to the newWff subF
								for (k = 0, noPossibleTrees = eqRule.get("lhsTrees").length; k < noPossibleTrees; k++) {
									console.log("Fwd Intro: iEq: ", iEq, ", i: ", i, " k:", k);
									if (eqRule.applyRule(-1, introMatchingPairs, newWffSubs[j], newWff, k).toString() === oldWff.toString()) {
										return { // If the application of the eqRule to the 
											"rule": eqRule,
											"direction": 1
										};
									}
								}
							}
						}
					} else { // the fwd applicatin of the rule doesn't need introduction
						for (k = 0, noPossibleTrees = eqRule.get("rhsTrees").length; k < noPossibleTrees; k++) {
							console.log("Fwd No Intro: iEq: ", iEq, ", i: ", i, " k:", k);
							if (eqRule.applyRule(1, matchingPairs, oldWffSubs[i], oldWff, k).toString() === newWff.toString()) {
								return {
									"rule": eqRule,
									"direction": 1
								};
							}
						}
					}
				}

				if (eqRule.get("bidirectional")) {
					matchingPairs = eqRule.isApplicable(-1, oldWffSubs[i]);
					if (matchingPairs) { // Then the equivalence rule is applicable to the current oldWff subF
						if (eqRule.get("bwdIntroSymbols").quantifiers.length + eqRule.get("bwdIntroSymbols").symbols.length >= 0) { // i.e bwd application may/may not requires introduction
							for (j = 0; j < newWffSubsLength; j++) { // For all the newWff subFs
								introMatchingPairs = eqRule.isApplicable(1, newWffSubs[j]);
								if (introMatchingPairs) { // If the eqRule is applicable to the newWff subF
									for (k = 0, noPossibleTrees = eqRule.get("rhsTrees").length; k < noPossibleTrees; k++) {
										console.log("Bwd (No) Intro: iEq: ", iEq, ", i: ", i, " k:", k);
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
	},

	// Takes in a variable (string) and formula
	// Returns true if the variable occurs free in the 
	occursFree : function (variable, formula) {
		return App.EquivalenceRule.occursFreeInstances(variable, formula).length > 0;
	},

	// Walks down the tree, building an array of the predicates in which variable
	// occurs free within formula.
	occursFreeInstancesRec : function (variable, formula, instances) {
		if (formula instanceof App.Quantifier && formula.get("variable") === variable) {
			return;
		}

		if (formula instanceof App.Predicate) {
			if (formula.containsTerm(variable)) {
				instances.push(formula);
			}
			return;
		}

		if (formula.get("left")) {
			App.EquivalenceRule.occursFreeInstancesRec(variable, formula.get("left"), instances);
		}

		if (formula.get("right")) {
			App.EquivalenceRule.occursFreeInstancesRec(variable, formula.get("right"), instances)
		}
	},


	// Portal function that allows us to return the instances array from the recursive function
	// above.
	occursFreeInstances : function (variable, formula) {
		var instances = [];
		App.EquivalenceRule.occursFreeInstancesRec(variable, formula, instances);
		return instances;
	},

	// Take in a variable (string) and formula
	// Returns true if the variable occurs either in free or bound.
	occurs : function (variable, formula) {
		var occInLeft = false,
			occInRight = false;
		
		if (formula instanceof App.Quantifier) {
			if (formula.get("variable") === variable) {
				return true;
			}
		}

		if (formula instanceof App.Predicate) { // go through the terms
			return formula.containsTerm(variable);
		}

		if (formula.get("left")) {
			occInLeft = App.EquivalenceRule.occurs(variable, formula.get("left"));
		}

		if (formula.get("right") && !occInLeft) { // short circuit - only check right if needed
			occInRight = App.EquivalenceRule.occurs(variable, formula.get("right"));
		}

		return occInLeft || occInRight;
	},

	renameFreeOccurences : function (variableToReplace, newVariable, subF, whole) {
		var newSubF = subF.deepClone(),
			predsWithVarToReplace = App.EquivalenceRule.occursFreeInstances(variableToReplace, newSubF.get("right"));

		// Set the new variable
		newSubF.set("variable", newVariable);

		// Go through the predicates with free occurences and replace those with new var.
		_.each(predsWithVarToReplace, function (pred) {
			_.each(pred.get("terms"), function (term) {
				if (term.get("symbol") === variableToReplace) {
					term.set("symbol", newVariable);
				}
			});
		});

		return whole.deepCloneReplace(subF, newSubF);
	}
});

App.NormalFormGenerator = Backbone.Model.extend({

	initialise : function () {
		// do nothing
	},

	// Takes a formula, an identifier function, and a reference to an eq rule that can eliminate that node type
	// Returns the formula without that node type if noSteps is defined, that many eliminated
	removeAll : function (formula, identifier, eqRule, noSteps) {
		var subFormulae = [],
			matchingPairs,
			i = 0;

		// Get all the subformulae from formulae
		formula.getSubFormulae(subFormulae);

		// Find an implication in the formula
		subFormulae = _.find(subFormulae, identifier);

		// While there are still implications within the formula
		while (i < noSteps && subFormulae) {
			// Get the matching pairs - already know the rule is applicable
			matchingPairs = eqRule.isApplicable(1, subFormulae);

			// Update the formula to be the result of applying the rule to the 
			formula = eqRule.applyRule(1, matchingPairs, subFormulae, formula);

			// Reset subformulae
			subFormulae = [];

			// Get the new sub formulae
			formula.getSubFormulae(subFormulae);

			// Find an implication in the formula
			subFormulae = _.find(subFormulae, identifier);

			// Increment the counter
			i++;
		}

		return formula;
	},

	implicationFree : function (formula) {
		formula = this.removeAll(formula, function (f) { return f instanceof App.DimplyNode; }, App.equivalenceRules.at(23), Infinity);
		return this.removeAll(formula, function (f) { return f instanceof App.ImplyNode; }, App.equivalenceRules.at(20), Infinity);
	},

	// Takes a formula with no implications in, returns a negation normal form formula
	// Straight from Huth - Logic in computer science - doesn't allow for single application
	// of an equivalence rule therefore use negationNormalFormI - my iterative version.
	negationNormalForm : function (formula) {
		var left = formula.get("left"),
			right = formula.get("right");

		// double negation
		if (formula instanceof App.NegationNode && right instanceof App.NegationNode) {
			return this.negationNormalForm(right.get("right"));
		} else if (formula instanceof App.AndNode) {
			return new App.AndNode({
				"left" : this.negationNormalForm(left),
				"right" : this.negationNormalForm(right)
			});
		} else if (formula instanceof App.OrNode) {
			return new App.OrNode({
				"left" : this.negationNormalForm(left),
				"right" : this.negationNormalForm(right)
			});
		} else if (formula instanceof App.NegationNode && right instanceof App.AndNode) {
			return new App.OrNode({
				"left" : this.negationNormalForm(new App.NegationNode({ "right" : right.get("left") })),
				"right" : this.negationNormalForm(new App.NegationNode({ "right" : right.get("right") }))
			});
		} else if (formula instanceof App.NegationNode && right instanceof App.OrNode) {
			return new App.AndNode({
				"left" : this.negationNormalForm(new App.NegationNode({ "right" : right.get("left") })),
				"right" : this.negationNormalForm(new App.NegationNode({ "right" : right.get("right") }))
			});
		} else {
			return formula.deepClone();
		}
	},

	// Takes a formula with no implications in and returns a negation normal form formula
	negationNormalFormI : function (formula, singleStep) {
		var dmNotAnd = App.equivalenceRules.at(29),
			dmNotOr = App.equivalenceRules.at(30),
			doubleNeg = App.equivalenceRules.at(14);

		do {
			// Save the current formula string
			fString = formula.toString();

			// Remove anything with de Morgans And
			formula = this.removeAll(
				formula,
				function (f) { return f instanceof App.NegationNode && f.get("right") instanceof App.AndNode; },
				dmNotAnd,
				singleStep ? 1 : Infinity
			);

			// If we're only doing a single step and it's been done, break out of loop
			if (singleStep && (formula.toString() !== fString)) { break; }

			// Remove anything with de Morgans Or
			formula = this.removeAll(
				formula,
				function (f) { return f instanceof App.NegationNode && f.get("right") instanceof App.OrNode; },
				dmNotOr,
				singleStep ? 1 : Infinity
			);
			if (singleStep && (formula.toString() !== fString)) { break; }

			// Remove anything with de Morgans And
			formula = this.removeAll(
				formula,
				function (f) { return f instanceof App.NegationNode && f.get("right") instanceof App.NegationNode; },
				doubleNeg,
				singleStep ? 1 : Infinity
			);
			if (singleStep && (formula.toString() !== fString)) { break; }
			
		} while (formula.toString() !== fString);

		return formula;
	},

	// Takes an implication free, nnf formula
	// Returns a formula in cnf
	conjunctiveNormalForm : function (formula) {
		var left = formula.get("left"),
			right = formula.get("right");

		if (formula instanceof App.AndNode) {
			return new App.AndNode({
				left : this.conjunctiveNormalForm(left),
				right : this.conjunctiveNormalForm(right)
			});
		} else if (formula instanceof App.OrNode) {
			return this.distr(this.conjunctiveNormalForm(left),
							  this.conjunctiveNormalForm(right));
		} else {
			return formula;
		}
	},

	// Takes left and right in cnf
	// computes the cnf form for left ∨ right
	distr : function (left, right) {
		if (left instanceof App.AndNode) {
			return new App.AndNode({
				"left" : this.distr(left.get("left"), right),
				"right" : this.distr(left.get("right"), right)
			});
		} else if (right instanceof App.AndNode) {
			return new App.AndNode({
				"left" : this.distr(left, right.get("left")),
				"right" : this.distr(left, right.get("right"))
			});
		} else {
			return new App.OrNode({ "left" : left, "right" : right })
		}
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
		"click a": "onEqRuleClick",
		"mouseenter i" : "onSolutionMouseenter",
		"mouseleave i" : "onSolutionMouseleave",
		"click i" : "onSolutionClick"
	},

	initialize: function () {
		this.model.on("change:active", this.onActiveChange, this);
	},

	render: function () {
		var renderedContent = this.template(this.model.toJSON()),
			proofBtn;
		
		this.$el.html(renderedContent);
		
		if (this.model.get("fromExercise") !== undefined) {
			proofBtn = this.make("i", { "class" : "pull-right icon-eye-open" }, "");
			this.$el.prepend(proofBtn);

			this.$('.icon-eye-open').tooltip({
				title : "Show proof",
				placement : "left",
				trigger : "manual"
			});
		}

		return this;
	},

	onEqRuleClick: function (e) {
		// Stop the URL changing and event bubbling
		e.preventDefault();
		e.stopPropagation();
		// Tell the current exercise that the selected equivalence rule has changed.
		App.vent.trigger("currentlySelectedEqRuleChange", this.model);
	},

	// Adds or removes the active class dependent on the data
	onActiveChange: function () {
		if (this.model.get("active")) {
			this.$el.addClass("active");
		} else {
			this.$el.removeClass("active");
		}
	},

	onSolutionClick : function () {
		App.vent.trigger("eqRuleSolutionClick", this.model.get("fromExercise"));
	},

	onSolutionMouseleave : function () {
		this.$('.icon-eye-open').tooltip("hide");
	},

	onSolutionMouseenter : function () {
		this.$('.icon-eye-open').tooltip("show");
	},

	onClose : function () {
		this.model.off(null, null, this);
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
		App.vent.on("userLoggedIn", this.onUserLoggedIn, this);

		// Bind to users about to log out - save all eq rules.
		App.vent.on("userLoggingOut", this.onUserLoggingOut, this);

		// An array to hold EquivalenceRuleViews
		this.eqRuleViewModelPairs = [];
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

		} else { // User EqRule - Add at the top
			if (header.length === 0) {
				$("<li class=\"nav-header\">" + eqRule.get("category") + "</li>").insertAfter(this.$("#newEqRuleBtn")).on("click", function () {
					$(this).nextUntil("li.nav-header").slideToggle();
				});
			}
			this.$("li.nav-header").eq(2).before(view.render().el);
		}

		this.eqRuleViewModelPairs.push([view, eqRule]);
	},

	onUserLoggedIn : function () {
		var self = this,
			unsavedEqRules = this.collection.rest(App.noBasicEqRules);

		this.collection.remove(unsavedEqRules);

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
		var unsavedEqRules = _.filter(this.collection.rest(App.noBasicEqRules), function (eqRule) { return eqRule.isNew(); })
		// Have to save synchronously to work when refreshing
		_.each(unsavedEqRules, function (eqRule) { eqRule.save({},{ async : false }); }); 

		// Remove all eqRules from this.collection past the default rules
		this.collection.remove(this.collection.rest(App.noBasicEqRules));
	},

	removeEqRule : function (eqRule) {
		// As only ever used to remove user eqs, reduce the search size.
		var userEqRuleViewModelPairs = _.rest(this.eqRuleViewModelPairs,App.noBasicEqRules);

		// Find the view, eqRule pair that holds the eqRule being deleted.
		var pairToRemove = _.find(userEqRuleViewModelPairs, function (pair) {
			return pair[1] === eqRule;
		});

		// Remove the view from the DOM
		pairToRemove[0].close();

		// Remove the view, eqRule pair from the array 
		this.eqRuleViewModelPairs = _.without(this.eqRuleViewModelPairs, pairToRemove);

		if (this.eqRuleViewModelPairs.length === App.noBasicEqRules) { // Then we have removed last user eqRule, remove header
			this.$(".nav-header").eq(1).remove();
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
	}, {
		rule: "∀X∀Y(A) ≡ ∀Y∀X(A)",
		bidirectional: false,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.UniversalQuantifier({
				variable : "Y",
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.UniversalQuantifier({
			variable : "Y",
			right: new App.UniversalQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "∃X∃Y(A) ≡ ∃Y∃X(A)",
		bidirectional: false,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.ExistensialQuantifier({
				variable : "Y",
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.ExistensialQuantifier({
			variable : "Y",
			right: new App.ExistensialQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "¬∀X(A) ≡ ∃X¬(A)",
		bidirectional: true,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.NegationNode({
			right: new App.UniversalQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "¬∃X(A) ≡ ∀X¬(A)",
		bidirectional: true,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.NegationNode({
			right: new App.ExistensialQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})],

		rhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.NegationNode({
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "∀X(A ∧ B) ≡ ∀X(A) ∧ ∀X(B)",
		bidirectional: true,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.AndNode({
				left : new App.Node({
					symbol : "A"
				}),
				right: new App.Node({
					symbol : "B"
				})
			})
		}),
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.AndNode({
				left : new App.Node({
					symbol : "B"
				}),
				right: new App.Node({
					symbol : "A"
				})
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "A"
				})
			}),
			right: new App.UniversalQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "B"
				})
			})
		}),
		new App.AndNode({
			left : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			}),
			right: new App.UniversalQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "∃X(A ∧ B) ≡ ∃X(A) ∧ ∃X(B)",
		bidirectional: true,
		category: "Predicate Equivalences",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.AndNode({
				left : new App.Node({
					symbol : "A"
				}),
				right: new App.Node({
					symbol : "B"
				})
			})
		}),
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.AndNode({
				left : new App.Node({
					symbol : "B"
				}),
				right: new App.Node({
					symbol : "A"
				})
			})
		})],

		rhsTrees: [
		new App.AndNode({
			left : new App.ExistensialQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "A"
				})
			}),
			right: new App.ExistensialQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "B"
				})
			})
		}),
		new App.AndNode({
			left : new App.ExistensialQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			}),
			right: new App.ExistensialQuantifier({
				variable : "X",
				right: new App.Node({
					symbol: "A"
				})
			})
		})]
	}, {
		rule: "∀X(A) ≡ A",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]
	}, {
		rule: "∃X(A) ≡ A",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.Node({
				symbol: "A"
			})
		})],

		rhsTrees: [
		new App.Node({
			symbol: "A"
		})]
	}, {
		rule: "∀X(A ∧ B) ≡ A ∧ ∀X(B)",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.AndNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.AndNode({
			left : new App.Node({
				symbol : "A"
			}),
			right : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			})
		})]
	}, {
		rule: "∀X(A ∨ B) ≡ A ∨ ∀X(B)",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.OrNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.OrNode({
			left : new App.Node({
				symbol : "A"
			}),
			right : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			})
		})]
	}, {
		rule: "∀X(A → B) ≡ A → ∃∀(B)",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.ImplyNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.ImplyNode({
			left : new App.Node({
				symbol : "A"
			}),
			right : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			})
		})]
	}, {
		rule: "∃X(A → B) ≡ A → ∃X(B)",
		bidirectional: true,
		freeVarCheck : [["X", "A"]], // This means X cannot occur free in A
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.ImplyNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.ImplyNode({
			left : new App.Node({
				symbol : "A"
			}),
			right : new App.ExistensialQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "B"
				})
			})
		})]
	}, {
		rule: "∀X(A → B) ≡ ∃X(A) → B",
		bidirectional: true,
		freeVarCheck : [["X", "B"]], 
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.ImplyNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.ImplyNode({
			left : new App.ExistensialQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "A"
				})
			}),
			right : new App.Node({
				symbol : "B"
			})
		})]
	}, {
		rule: "∃X(A → B) ≡ ∀X(A) → B",
		bidirectional: true,
		freeVarCheck : [["X", "B"]],
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.ImplyNode({
				left : new App.Node({
					symbol : "A"
				}),
				right : new App.Node({
					symbol : "B"
				})
			}),

		})],

		rhsTrees: [
		new App.ImplyNode({
			left : new App.UniversalQuantifier({
				variable : "X",
				right : new App.Node({
					symbol : "A"
				})
			}),
			right : new App.Node({
				symbol : "B"
			})
		})]
	}, {
		rule : "Rename Variable",
		bidirectional : false,
		category: "Predicate Equivalences Involving Bound Variables",

		lhsTrees: [
		new App.ExistensialQuantifier({
			variable : "X",
			right: new App.Node({
				symbol : "A"
			})
		}),
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.Node({
				symbol : "A"
			})
		})],
		rhsTrees : [
		new App.UniversalQuantifier({
			variable : "X",
			right: new App.Node({
				symbol : "A"
			})
		})]
	}

]);

App.noBasicEqRules = App.equivalenceRules.length;