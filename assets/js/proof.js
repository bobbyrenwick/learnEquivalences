// Gives an idea of just how slow backbone is in comparison to normal objects.
// Let's try making normal objects.

App = App || {};

App.SearchNode = function (state, pathCost) {
	this.pathCost = pathCost;
	this.state = state;
};

// action is the eqRule to apply and the direction in which to apply it.
App.ChildNode = function (problem, parent, action) {
	var matchingPairs = action.eqRule.isApplicable(action.direction, action.subF);

	this.state = action.eqRule.applyRule(action.direction, matchingPairs, action.subF, action.whole);
	this.parent = parent;
	this.action = action;
	this.pathCost = parent.pathCost + 1;
};


// Need to work out what this function actually does!
App.Solution = function (node) {

};

App.matchingTrees = function (tree1, tree2) {
	if (tree2 instanceof App.BinaryNode) {
		// the the top level structure of the tree is the same keep matching
		if (tree1 instanceof App.BinaryNode && tree1.get("symbol") === tree2.get("symbol")) {
			// match recursively the left and right, if either returns false, then whole function should return false
			return App.matchingTrees(tree1.get("left"), tree2.get("left")) && 
				App.matchingTrees(tree1.get("right"), tree2.get("right"));
		} else {
			return false;
		}
	} else if (tree2 instanceof App.Quantifier) {
		if (tree1 instanceof App.Quantifer && tree1.get("symbol") === tree2.get("symbol") &&
			tree1.get("variable") === tree2.get("variable")) {
			return App.matchingTrees(tree1.get("right"), tree2.get("right"));
		} else {
			return false;
		}
	} else if (tree2 instanceof App.UnaryNode) {
		// match recursively right, if it returns false, then whole function should return false
		if (tree1 instanceof App.UnaryNode && tree1.get("symbol") === tree2.get("symbol")) {
			return App.matchingTrees(tree1.get("right"), tree2.get("right"));
		} else {
			return false;
		}
	} else if (tree2 instanceof App.Tautology) {
		return tree1 instanceof App.Tautology;
	} else if (tree2 instanceof App.Contradiction) {
		return tree1 instanceof App.Contradiction;
	} else { // Reached an atom
		return tree1.get("symbol") === tree2.get("symbol")
	}
};

// For now ignore any rules that require an introduction.
App.findApplicableEqRules = function(formula) {
	var fwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.isApplicable(1, formula) && 
				eqRule.get("fwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("fwdIntroSymbols").symbols.length === 0 &&
				!eqRule.alwaysApplicable(1);
		});

	var bwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.isApplicable(-1, formula) && 
				eqRule.get("bwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("bwdIntroSymbols").symbols.length === 0 &&
				!eqRule.alwaysApplicable(-1);
		});

	return [fwdApplicableRules, bwdApplicableRules];
};



// FIFO queue
// empty - array.length === 0
// push - pushes to the end of the array
// shift - removes elements from the front of the array

// LIFO queue
// empty - array.length === 0
// push - pushes to the end of the array
// pop - removes element form the end of the array

// Takes in a problem object 
// problem = {
//	initialState - the current full step formula
// 	goalTest() - takes a full step formula and returns whether it is equal to initialState
// }

// For now, ignore any problems that would require an introduction.
App.breadthFirstSearch = function (problem) {
	console.time("breadthFirstSearch timer");
	var node = new App.SearchNode(problem.initialState, 0);
	if (problem.goalTest(node.state)) { return new Solution(node); }
	var frontier = [node]; // FIFO queue with node as the only element
	var explored = {}; // an empty set - using as a hash table to allow constant lookup times
	var noNodesExamined = 0;

	// Takes a node.state - returns the formula if it is in frontier, otherwise - false.
	var isInFrontier = function (nodeState) {
		for (var i = frontier.length - 1; i >= 0; i--) {
			var formula = frontier[i];
			if (App.matchingTrees(nodeState, formula.state)) {
				return formula;
			}
		}
		return false;
	};

	while (frontier.length > 0) { // while there are still nodes in teh queue
		node = frontier.shift();
		noNodesExamined++;

		// Add node.state to the hash table
		explored[node.state.toString()] = 1;

		// Get all the subformulae of the current state
		var subF = [];
		node.state.getSubFormulae(subF);

		for (m = 0, n = subF.length; m < n; m++) {
			var curSubF = subF[m]; // cache the current sub formula
			var applicableRules = App.findApplicableEqRules(curSubF);

			for (i = 0; i < applicableRules.length; i++) { // for both rules that are applicable fwds and bwds.
				for (j = 0, l = applicableRules[i].length; j < l; j++) { 
					var eqRule = applicableRules[i][j];
					var dir = (i === 0 ? 1 : -1); // if on first array of applicable rules, going fwds.
					var child = new App.ChildNode(problem, node, { direction : dir, eqRule : eqRule, subF : curSubF, whole : node.state });

					//var alreadyInFrontier = isInFrontier(child.state);
					// If this state isn't in explored or in frontier
					if (_.isUndefined(explored[child.state.toString()])) {
						if (problem.goalTest(child.state)) {
							console.timeEnd("breadthFirstSearch timer");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						}

						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
}

App.Problem = function (initialState, goal) {
	this.initialState = initialState;
	this.goal = goal;
	this.goalTest = function (node) {
		return App.matchingTrees(node, this.goal);
	};
}

App.testProb1 = new App.NegationNode({
	right : new App.NegationNode({
			right : new App.Node({ symbol : "A" })
	})
});

App.testProb2 = new App.Node({ symbol : "A" });

App.testProb3 = new App.ImplyNode({
	left : new App.Node({ symbol : "P" }),
	right : new App.ImplyNode({
		left : new App.Node({ symbol : "Q" }),
		right : new App.Node({ symbol : "R" })
	})
});

App.testProb4 = new App.ImplyNode({
	left : new App.ImplyNode({ 
		left : new App.Node({ symbol : "P" }),
		right : new App.Node({ symbol : "Q" })
	}),
	right : new App.ImplyNode({
		left : new App.Node({ symbol : "P" }),
		right : new App.Node({ symbol : "R" })
	})
});


App.testProb5 = new App.AndNode({
	left : new App.ImplyNode({ 
		left : new App.Node({ symbol : "P" }),
		right : new App.Node({ symbol : "R" })
	}),
	right : new App.ImplyNode({
		left : new App.Node({ symbol : "Q" }),
		right : new App.Node({ symbol : "R" })
	})
});

App.testProb6 = new App.ImplyNode({
	left : new App.OrNode({ 
		left : new App.Node({ symbol : "P" }),
		right : new App.Node({ symbol : "Q" })
	}),
	right : new App.Node({ symbol : "R" })
});

App.testProb7 = new App.NegationNode({
	right : new App.NegationNode({
		right : new App.NegationNode({
			right : new App.NegationNode({
				right : new App.NegationNode({
					right : new App.NegationNode({
						right : new App.Node({ symbol : "A" })
					})
				})
			})	
		})
	})
});

App.testProb8 = new App.Node({ symbol : "A" });

// TODO : get rid of all the eq rules that cna be applied to anything - can catch them in the other direction.