App = App || {};

App.SearchNode = function (state, pathCost) {
	this.pathCost = pathCost;
	this.state = state;
	this.stateString = state.toString();
};

// action is the eqRule to apply and the direction in which to apply it.
App.ChildNode = function (problem, parent, action) {
	var matchingPairs = action.eqRule.isApplicableQuick(action.direction, action.subF);

	this.state = action.eqRule.applyRuleQuick(action.direction, matchingPairs, action.subF, action.whole);
	this.stateString = this.state.toString();
	this.parent = parent;
	this.action = action;
	this.pathCost = parent.pathCost + 1;
};

App.OneSidedSolution = function (prob, side) {
	var sideArr = App.searchNodeToArray(side),
		fwdSideArr,
		bwdSideArr;

	// If side1's top parent (last element in array) is equal to the goal
	// then side1 is from bottom up.
	if (prob.goalTest(_.last(sideArr).stateString)) {
		fwdSideArr = null;
		bwdSideArr = sideArr;
	} else {
		fwdSideArr = sideArr;
		bwdSideArr = null;
	}

	if (bwdSideArr) {
		this.bwdSideArr = App.searchArrToBackboneAndEqRule(bwdSideArr);
		this.fwdSideArr = null;	
	} else {
		this.fwdSideArr = App.searchArrToBackboneAndEqRule(fwdSideArr);
		this.bwdSiedArr = null;
	}

};

App.TwoSidedSolution = function (prob, side1, side2) {
	var side1Arr = App.searchNodeToArray(side1),
		side2Arr = App.searchNodeToArray(side2),
		fwdSideArr,
		bwdSideArr;

	// If side1's top parent (last element in array) is equal to the goal
	// then side1 is from bottom up.
	if (prob.goalTest(_.last(side1Arr).stateString)) {
		fwdSideArr = side2Arr;
		bwdSideArr = side1Arr;
	} else {
		fwdSideArr = side1Arr;
		bwdSideArr = side2Arr;
	}

	this.fwdSideArr = App.searchArrToBackboneAndEqRule(fwdSideArr);
	this.bwdSideArr = App.searchArrToBackboneAndEqRule(bwdSideArr);
};

App.searchNodeToArray = function (child) {
	var arr = [child],
		parent = child.parent;

	while (parent !== undefined) {
		arr.push(parent);
		parent = parent.parent;
	}

	return arr;
};

App.searchArrToBackboneAndEqRule = function (arr) {
	var arrB = _.map(arr, function (searchNode) {
		searchNode.backboneState = App.parser.parse(searchNode.stateString);

		if (searchNode.pathCost !== 0) {
			searchNode.eqRule = searchNode.action.eqRule;
			searchNode.direction = searchNode.action.direction;
			delete searchNode.action;
		}

		// delete all thigns that are no longer needed;
		delete searchNode.pathCost;
		delete searchNode.state;
		delete searchNode.stateString;

		return searchNode;
	}).reverse();

	return arrB;
};

// For now ignore any rules that require an introduction.
App.findApplicableEqRules = function(formula) {
	var fwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.isApplicableQuick(1, formula) && 
				eqRule.get("fwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("fwdIntroSymbols").symbols.length === 0 &&
				!eqRule.alwaysApplicable(1);
		});

	var bwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.isApplicableQuick(-1, formula) && 
				eqRule.get("bwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("bwdIntroSymbols").symbols.length === 0 &&
				!eqRule.alwaysApplicable(-1);
		});

	return [fwdApplicableRules, bwdApplicableRules];
};

// For now ignore any rules that require an introduction.
App.findApplicableEqRulesPr = function(formula) {
	var fwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.get("fwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("fwdIntroSymbols").symbols.length === 0 &&
				eqRule.get("probabilities")[0] > Math.random() &&
				eqRule.isApplicableQuick(1, formula);
		});

	var bwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.get("bwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("bwdIntroSymbols").symbols.length === 0 &&
				eqRule.get("probabilities")[1] > Math.random() &&
				eqRule.isApplicableQuick(-1, formula);
		});

	return [fwdApplicableRules, bwdApplicableRules];
};

// For now ignore any rules that require an introduction.
App.findApplicableEqRulesForEqGen = function(formula) {
	var fwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.get("forEqGen") &&
				eqRule.get("fwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("fwdIntroSymbols").symbols.length === 0 && 
				!eqRule.alwaysApplicable(1) &&
				eqRule.isApplicableQuick(1, formula);
				
		});

	var bwdApplicableRules = App.equivalenceRules.filter(function(eqRule) { 
			return eqRule.get("forEqGen") &&
				eqRule.get("bwdIntroSymbols").quantifiers.length === 0 && 
				eqRule.get("bwdIntroSymbols").symbols.length === 0 &&
				!eqRule.alwaysApplicable(-1) &&
				eqRule.isApplicableQuick(-1, formula);
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

App.breadthFirstSearch = function (problem) {
	console.time("Time taken:");
	var node = new App.SearchNode(problem.initialState, 0);
	if (problem.goalTest(node.state)) { return new Solution(node); }
	var frontier = [node]; // FIFO queue with node as the only element
	
	var sortedExploredAndQueue = App.SortedList.create([node], { compare : function (a, b) { 
			return (a.stateString > b.stateString) ? 1 : (a.stateString == b.stateString)  ? 0 : -1;
		}
	});
	
	//var explored = {}; // an empty set - using as a hash table to allow constant lookup times
	var noNodesExamined = 0;

	// Takes a node.state - returns the formula if it is in frontier, otherwise - false.
	var isInFrontier = function (node) {
		var nodeStateString = node.stateString;
		for (var i = frontier.length - 1; i >= 0; i--) {
			var formula = frontier[i];
			if (formula.stateString === nodeStateString) return true;
		}
		return false;
	};



	while (frontier.length > 0) { // while there are still nodes in teh queue
		node = frontier.shift();
		

		// Add node.state to the hash table
		// explored[node.stateString] = 1;

		// Add node's stateString to the sorted list
		sortedExploredAndQueue.insertOne(node);

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


					//var alreadyInFrontier = isInFrontier(child);
					// If this state isn't in explored or in frontier
					//if (_.isUndefined(explored[child.state.toString()])) {
					if (sortedExploredAndQueue.key({ stateString : child.stateString }) === null) {
						if (problem.goalTest(child.state)) {
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						}

						sortedExploredAndQueue.insertOne(child);
						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
}

App.breadthFirstSearchBothDirections = function (problem) {
	console.time("Time taken:");

	// Create problems for both backwards and forwards.
	var fwdProb = problem;
	var bwdProb = new App.Problem(fwdProb.goal, fwdProb.initialState);
	
	var fwdNode = new App.SearchNode(fwdProb.initialState, 0);
	var bwdNode = new App.SearchNode(bwdProb.initialState, 0);

	// Only check once as it is the same for bwds and fwds.
	if (problem.goalTest(fwdNode.state)) { return new Solution(fwdNode); }
	
	var fwdFrontier = [fwdNode]; // FIFO queue with node as the only element
	var bwdFrontier = [bwdNode];

	var fwdSortedExploredAndQueue = App.SortedList.create([fwdNode], { compare : function (a, b) { 
			return (a.stateString > b.stateString) ? 1 : (a.stateString == b.stateString)  ? 0 : -1;
		}
	});

	var bwdSortedExploredAndQueue = App.SortedList.create([bwdNode], { compare : function (a, b) { 
			return (a.stateString > b.stateString) ? 1 : (a.stateString == b.stateString)  ? 0 : -1;
		}
	});
	
	var noNodesExamined = 0;
	var lastDir = -1;

	// TODO: From here need to work out how to make them go bwds and fwds at the same time.

	while (fwdFrontier.length + bwdFrontier.length > 0) { // while there are still nodes in either queue
		
		// Direction should swap if there are still things left in the frontier
		var thisDir = lastDir < 0 ? (fwdFrontier.length > 0 ? 1 : -1) : (bwdFrontier.length > 0 ? -1 : 1);
		lastDir = lastDir < 0 ? 1 : -1;
		var frontier = thisDir < 0 ? bwdFrontier : fwdFrontier;
		var thisDirSortedExploredAndQueue = thisDir < 0 ? bwdSortedExploredAndQueue : fwdSortedExploredAndQueue;
		var opDirSortedExploredAndQueue = thisDir < 0 ? fwdSortedExploredAndQueue : bwdSortedExploredAndQueue;;

		node = frontier.shift();
		noNodesExamined++;

		// Add node's stateString to the sorted list
		thisDirSortedExploredAndQueue.insertOne(node);

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

					if (thisDirSortedExploredAndQueue.key({ stateString : child.stateString }) === null) {
						if (problem.goalTest(child.state)) {
							debugger;
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						} else if (opDirSortedExploredAndQueue.key({ stateString : child.stateString }) !== null) {
							console.log(opDirSortedExploredAndQueue[opDirSortedExploredAndQueue.key({ stateString : child.stateString })]);
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						}

						thisDirSortedExploredAndQueue.insertOne(child);
						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
};

App.breadthFirstSearchBothDirectionsHash = function (problem) {
	console.time("Time taken:");

	// Create problems for both backwards and forwards.
	var fwdProb = problem;
	var bwdProb = new App.Problem(fwdProb.goal, fwdProb.initialState);
	
	var fwdNode = new App.SearchNode(fwdProb.initialState, 0);
	var bwdNode = new App.SearchNode(bwdProb.initialState, 0);

	// Only check once as it is the same for bwds and fwds.
	if (problem.goalTest(fwdNode.state)) { return new Solution(fwdNode); }
	
	var fwdFrontier = [fwdNode]; // FIFO queue with node as the only element
	var bwdFrontier = [bwdNode];

	var fwdSortedExploredAndQueue = {};
	fwdSortedExploredAndQueue[fwdNode.stateString] = fwdNode;

	var bwdSortedExploredAndQueue = {};
	bwdSortedExploredAndQueue[bwdNode.stateString] = bwdNode;	
	
	var noNodesExamined = 0;
	var lastDir = -1;

	while (fwdFrontier.length + bwdFrontier.length > 0) { // while there are still nodes in either queue
		
		// Direction should swap if there are still things left in the frontier
		var thisDir = lastDir < 0 ? (fwdFrontier.length > 0 ? 1 : -1) : (bwdFrontier.length > 0 ? -1 : 1);
		lastDir = lastDir < 0 ? 1 : -1;
		var frontier = thisDir < 0 ? bwdFrontier : fwdFrontier;
		var thisDirSortedExploredAndQueue = thisDir < 0 ? bwdSortedExploredAndQueue : fwdSortedExploredAndQueue;
		var opDirSortedExploredAndQueue = thisDir < 0 ? fwdSortedExploredAndQueue : bwdSortedExploredAndQueue;;

		node = frontier.shift();
		noNodesExamined++;

		// Add node's stateString to the sorted list
		thisDirSortedExploredAndQueue[node.stateString] = node;

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

					if (thisDirSortedExploredAndQueue[child.stateString] === undefined) {
						if (problem.goalTest(child.state)) {
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						} else if (opDirSortedExploredAndQueue[child.stateString] !== undefined) {
							console.log(opDirSortedExploredAndQueue[child.stateString]);
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						}

						thisDirSortedExploredAndQueue[child.stateString] = child;
						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
};

App.breadthFirstSearchBothDirectionsHashPr = function (problem) {
	console.time("Time taken:");

	// Create problems for both backwards and forwards.
	var fwdProb = problem;
	var bwdProb = new App.Problem(fwdProb.goal, fwdProb.initialState);
	
	var fwdNode = new App.SearchNode(fwdProb.initialState, 0);
	var bwdNode = new App.SearchNode(bwdProb.initialState, 0);

	// Only check once as it is the same for bwds and fwds.
	if (problem.goalTest(fwdNode.state)) { return new Solution(fwdNode); }
	
	var fwdFrontier = [fwdNode]; // FIFO queue with node as the only element
	var bwdFrontier = [bwdNode];

	var fwdSortedExploredAndQueue = {};
	fwdSortedExploredAndQueue[fwdNode.stateString] = fwdNode;

	var bwdSortedExploredAndQueue = {};
	bwdSortedExploredAndQueue[bwdNode.stateString] = bwdNode;	
	
	var noNodesExamined = 0;
	var lastDir = -1;

	while (fwdFrontier.length + bwdFrontier.length > 0) { // while there are still nodes in either queue
		
		// Direction should swap if there are still things left in the frontier
		var thisDir = lastDir < 0 ? (fwdFrontier.length > 0 ? 1 : -1) : (bwdFrontier.length > 0 ? -1 : 1);
		lastDir = lastDir < 0 ? 1 : -1;
		var frontier = thisDir < 0 ? bwdFrontier : fwdFrontier;
		var thisDirSortedExploredAndQueue = thisDir < 0 ? bwdSortedExploredAndQueue : fwdSortedExploredAndQueue;
		var opDirSortedExploredAndQueue = thisDir < 0 ? fwdSortedExploredAndQueue : bwdSortedExploredAndQueue;;

		node = frontier.shift();

		// Add node's stateString to the sorted list
		thisDirSortedExploredAndQueue[node.stateString] = node;

		// Get all the subformulae of the current state
		var subF = [];
		node.state.getSubFormulae(subF);

		for (m = 0, n = subF.length; m < n; m++) {
			var curSubF = subF[m]; // cache the current sub formula
			var applicableRules = App.findApplicableEqRulesPr(curSubF);

			for (i = 0; i < applicableRules.length; i++) { // for both rules that are applicable fwds and bwds.
				for (j = 0, l = applicableRules[i].length; j < l; j++) { 
					var eqRule = applicableRules[i][j];
					var dir = (i === 0 ? 1 : -1); // if on first array of applicable rules, going fwds.
					var child = new App.ChildNode(problem, node, { direction : dir, eqRule : eqRule, subF : curSubF, whole : node.state });
					noNodesExamined++;

					if (thisDirSortedExploredAndQueue[child.stateString] === undefined) {
						if (problem.goalTest(child.state)) {
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						} else if (opDirSortedExploredAndQueue[child.stateString] !== undefined) {
							console.log(opDirSortedExploredAndQueue[child.stateString]);
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return child; 
						}

						thisDirSortedExploredAndQueue[child.stateString] = child;
						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
};

App.breadthFirstSearchBothDirectionsHashPrTimed = function (problem) {
	console.time("Time taken:");
	var finish = Date.now() + 10000; // Give max of 10 seconds for execution

	// Create problems for both backwards and forwards.
	var fwdProb = problem;
	var bwdProb = new App.Problem(fwdProb.goal, fwdProb.initialState);
	
	var fwdNode = new App.SearchNode(fwdProb.initialState, 0);
	var bwdNode = new App.SearchNode(bwdProb.initialState, 0);

	// Only check once as it is the same for bwds and fwds.
	if (problem.goalTest(fwdNode.state)) { return new App.OneSidedSolution(problem, fwdNode); }
	
	var fwdFrontier = [fwdNode]; // FIFO queue with node as the only element
	var bwdFrontier = [bwdNode];

	var fwdSortedExploredAndQueue = {};
	fwdSortedExploredAndQueue[fwdNode.stateString] = fwdNode;

	var bwdSortedExploredAndQueue = {};
	bwdSortedExploredAndQueue[bwdNode.stateString] = bwdNode;	
	
	var noNodesExamined = 0;
	var lastDir = -1;

	while (fwdFrontier.length + bwdFrontier.length > 0) { // while there are still nodes in either queue
		
		// Direction should swap if there are still things left in the frontier
		var thisDir = lastDir < 0 ? (fwdFrontier.length > 0 ? 1 : -1) : (bwdFrontier.length > 0 ? -1 : 1);
		lastDir = lastDir < 0 ? 1 : -1;
		var frontier = thisDir < 0 ? bwdFrontier : fwdFrontier;
		var thisDirSortedExploredAndQueue = thisDir < 0 ? bwdSortedExploredAndQueue : fwdSortedExploredAndQueue;
		var opDirSortedExploredAndQueue = thisDir < 0 ? fwdSortedExploredAndQueue : bwdSortedExploredAndQueue;;

		node = frontier.shift();

		// Add node's stateString to the sorted list
		thisDirSortedExploredAndQueue[node.stateString] = node;

		// Get all the subformulae of the current state
		var subF = [];
		node.state.getSubFormulae(subF);

		for (m = 0, n = subF.length; m < n; m++) {
			var curSubF = subF[m]; // cache the current sub formula
			var applicableRules = App.findApplicableEqRulesPr(curSubF);

			for (i = 0; i < applicableRules.length; i++) { // for both rules that are applicable fwds and bwds.
				for (j = 0, l = applicableRules[i].length; j < l; j++) { 
					var eqRule = applicableRules[i][j];
					var dir = (i === 0 ? 1 : -1); // if on first array of applicable rules, going fwds.
					var child = new App.ChildNode(problem, node, { direction : dir, eqRule : eqRule, subF : curSubF, whole : node.state });
					noNodesExamined++;

					if (thisDirSortedExploredAndQueue[child.stateString] === undefined) {
						if (problem.goalTest(child.state)) {
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return new App.OneSidedSolution(problem, child); 
						} else if (opDirSortedExploredAndQueue[child.stateString] !== undefined) {
							console.timeEnd("Time taken:");
							console.log("No nodes examined: ", noNodesExamined); 
							return new App.TwoSidedSolution(problem, child, opDirSortedExploredAndQueue[child.stateString]); 
						} else if (Date.now() - finish >= 0) {
							return "Unfortunately we couldn't find a hint quickly enough.";
						}

						thisDirSortedExploredAndQueue[child.stateString] = child;
						frontier.push(child);
					} 
				}
			}
		}
	}

	return false;
};

App.Problem = function (initialState, goal) {
	this.initialState = initialState;
	this.goal = goal;
	this.goalString = this.goal.toString();
	this.goalTest = function (nodeState) {
		return nodeState.toString() === this.goalString;
	};
};

App.testProb1 = new App.NegationNodeNormal(
	new App.NegationNodeNormal(
		new App.NodeNormal("A")
	)
);

App.testProb2 = new App.NodeNormal("A");

App.testProb3 = new App.ImplyNodeNormal(
	new App.NodeNormal("P"),
	new App.ImplyNodeNormal(
		new App.NodeNormal("Q"),
		new App.NodeNormal("R")
	)
);

App.testProb4 = new App.ImplyNodeNormal(
	new App.ImplyNodeNormal(
		new App.NodeNormal("P"),
		new App.NodeNormal("Q")
	),
	new App.ImplyNodeNormal(
		new App.NodeNormal("P"),
		new App.NodeNormal("R")
	)
);


App.testProb5 = new App.AndNodeNormal(
	new App.ImplyNodeNormal(
		new App.NodeNormal("P"),
		new App.NodeNormal("R")
	),
	new App.ImplyNodeNormal(
		new App.NodeNormal("Q"),
		new App.NodeNormal("R")
	)
);

App.testProb6 = new App.ImplyNodeNormal(
	new App.OrNodeNormal(
		new App.NodeNormal("P"),
		new App.NodeNormal("Q")
	),
	new App.NodeNormal("R")
);

App.testProb7 = new App.NegationNodeNormal(
	new App.NegationNodeNormal(
		new App.NegationNodeNormal(
			new App.NegationNodeNormal(
				new App.NegationNodeNormal(
					new App.NegationNodeNormal(
						new App.NodeNormal("A")
					)
				)
			)	
		)
	)
);

App.testProb8 = new App.NodeNormal("A");

// Goes with testProb6
App.testProb9 = new App.AndNodeNormal(
	new App.ImplyNodeNormal(
		new App.NegationNodeNormal(
			new App.NegationNodeNormal(
				new App.NodeNormal("P")
			)
		),
		new App.NodeNormal("R")
	),
	new App.ImplyNodeNormal(
		new App.NodeNormal("Q"),
		new App.NodeNormal("R")
	)
);

App.testProb10 = new App.OrNodeNormal(
	new App.NegationNodeNormal(
		new App.DimplyNodeNormal(
			new App.NodeNormal("P"),
			new App.NodeNormal("Q")
		),
		new App.NodeNormal("Q")
	),
	new App.NodeNormal("Q")
);

App.testProb11 = new App.OrNodeNormal(
	new App.NodeNormal("P"),
	new App.ImplyNodeNormal(
		new App.ImplyNodeNormal(
			new App.NodeNormal("Q"),
			new App.NodeNormal("P")
		),
		new App.NodeNormal("P")
	)
);

App.testProb12 = new App.OrNodeNormal(
	new App.NodeNormal("P"),
	new App.ImplyNodeNormal(
		new App.ImplyNodeNormal(
			new App.NodeNormal("Q"),
			new App.NodeNormal("P")
		),
		new App.NodeNormal("P")
	)
);