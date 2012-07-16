<?php

require 'Slim/Slim.php';
require 'PassHash.php';

$app = new Slim(array(
    'cookies.lifetime' => '2 days',
    'cookies.secret_key' => 'superDuperKey'
));

// Checks to see if a username is already taken
$app->get('/usernameTaken/:user', function ($username) use ($app) {
	try {
		$db = connectToDb();
		$users = $db->users;
		$user = $users->findOne(array('username' => $username));
		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';
		if ($user) {
			echo '{ "error" : "This username is already taken. Please try another." }';
		} else {
			echo '{ "exists" : false }';
		}
	} catch (MongoConnectionException $e) {
		echo '{ "error" : "UH OH! We hit a problem. Please try again later." }';
	}
});

// Adds a user to the database
$app->post('/addUsername', function () use ($app) {
	try {
		$db = connectToDb();
		$users = $db->users;

		$request = Slim::getInstance()->request();
		$userToAdd = json_decode($request->getBody());
		
		$username = $userToAdd->username;
		//check to see if already in there
		$user = $users->findOne(array('username' => $username));

		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';
		
		if ($user) { // The username already exists! Failure
			echo '{ "error" : "The username already exists" }';
		} else {
			// Hash the password, remove the plain password
			$userToAdd->hashedPass = PassHash::hash($userToAdd->password);
			unset($userToAdd->password);
			
			// Add the user to the database.
			$users->insert($userToAdd, array('safe' => TRUE));
			$app->setCookie('username', $username);
			// Set an encrypted cookie with uername in it as an access token
			$app->setEncryptedCookie('access_token', $username);
			echo '{ "error" : false }';
		}
	} catch (MongoConnectionException $e) {
		echo '{ "error" : "UH OH! We hit a problem. Please try again later." }';
	} catch (MongoCursorException $e) {
		echo '{ "error" : "UH OH! We couldn\'t add you to the database." }';
	} 
});

// Logs a user in
$app->post('/login', function () use ($app) {
	try {
		$db = connectToDb();
		$users = $db->users;

		$request = Slim::getInstance()->request();
		$loginDetails = json_decode($request->getBody());
		
		$username = $loginDetails->username;
		// find the user
		$user = $users->findOne(array('username' => $username));

		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';
	
		if ($user) { // The username exists
			// check the password the user tried to login with
			if (PassHash::check_password($user["hashedPass"], $loginDetails->password)) {  
		    	// grant access  
				$app->setCookie('username', $username);
				// Set an encrypted cookie with uername in it as an access token
				$app->setEncryptedCookie('access_token', $username);
				echo '{ "error" : false }'; 
			} else {  
			    // deny access - type 0 = username error, 1 = password error, 2 = general error
			    echo '{ "error" : { "message" :"The password is incorrect." , "type" : 1 } }';
			}
		} else {;
			echo '{ "error" : { "message" :"This username doesn\'t exist." , "type" : 0 } }';
		}
	} catch (MongoConnectionException $e) {
		echo '{ "error" : { "message" :"UH OH! We hit a problem. Please try again later." , "type" : 2 } }';
	}
});


$app->get('/logout', function () use ($app) {
	$app->deleteCookie('username');
	$app->deleteCookie('access_token');
});

$app->get('/eqRule', function () use ($app) {

});

$app->post('/eqRule', function () use ($app) {
	// Get the request
	$request = Slim::getInstance()->request();
	$eqRule = json_decode($request->getBody());
	
	$username = $app->getEncryptedCookie('access_token');
   	
    if ( $username ) {
        $eqRule->username = $username;
    }

	// Set the response type to JSON
	$response = $app->response();
	$response['Content-Type'] = 'application/json';

	// Connect to mongoDB
	try {
		$db = connectToDb();
		$collection = $db->eqrules;
		$collection->insert($eqRule, array('safe' => TRUE));

		// Extract the id into plain string instead of object
		$eqRule->_id = $eqRule->_id->{'$id'};

		echo json_encode($eqRule);
	} catch (Exception $e) {
		echo '{"error":{"message":'. $e->getMessage() .'}}';
	}
});

$app->put('/eqRule', function () use ($app) {
	// Get the request
	$request = Slim::getInstance()->request();
	$eqRule = json_decode($request->getBody());
	
	$username = $app->getEncryptedCookie('access_token');
   	
   	
    if ( $username ) {
        $eqRule->username = $username;
    
		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';

		$mongoID = new MongoID($eqRule->_id);

		// Connect to mongoDB
		try {
			$db = connectToDb();
			$eqrules = $db->eqrules;
			$eqrules->update(array('_id' => $mongoID), array('$set' => array("username" => $username)));
		} catch (Exception $e) {
			echo '{"error":{"message":'. $e->getMessage() .'}}';
		}
	}
});

$app->get('/userEqRules', function () use ($app) {
	$username = $app->getEncryptedCookie('access_token');
	if ( $username ) {
		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';

		// Connect to mongoDB
		try {
			$db = connectToDb();
			$eqrules = $db->eqrules;
			$cursor = $eqrules->find(array('username' => $username));

			$userEqRules = array();
			foreach ($cursor as $doc) {
				// Extract the id into plain string instead of object
				$doc["_id"] = $doc["_id"]->{'$id'};
				$userEqRules[] = $doc;
			}

			echo '{ "error" : false, "eqRules" : '.json_encode($userEqRules).' }';
		} catch (Exception $e) {
			echo '{"error":{"message":'. $e->getMessage() .'}}';
		}
	}
});

$app->post('/exercise', function () use ($app) {
	// Get the request
	$request = Slim::getInstance()->request();
	$exercise = json_decode($request->getBody());
	
	$username = $app->getEncryptedCookie('access_token');
   	
    if ( $username ) {
        $exercise->username = $username;
    }

	// Set the response type to JSON
	$response = $app->response();
	$response['Content-Type'] = 'application/json';

	// Connect to mongoDB
	try {
		$db = connectToDb();
		$collection = $db->exercises;
		$collection->insert($exercise, array('safe' => TRUE));

		// Extract the id into plain string instead of object
		$exercise->_id = $exercise->_id->{'$id'};

		echo json_encode($exercise);
	} catch (Exception $e) {
		echo '{"error":{"message":'. $e->getMessage() .'}}';
	}
});

$app->put('/exercise', function () use ($app) {
	// Get the request
	$request = Slim::getInstance()->request();
	$exercise = json_decode($request->getBody());
	
	$username = $app->getEncryptedCookie('access_token');
   	
   	
    if ( $username ) {
        $exercise->username = $username;
    
		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';

		$mongoID = new MongoID($exercise->_id);

		// Connect to mongoDB
		try {
			$db = connectToDb();
			$exercises = $db->exercises;
			$exercises->update(array('_id' => $mongoID), array('$set' => array("username" => $username)));
		} catch (Exception $e) {
			echo '{"error":{"message":'. $e->getMessage() .'}}';
		}
	}
});

$app->get('/userExercises', function () use ($app) {
	$username = $app->getEncryptedCookie('access_token');
	if ( $username ) {
		// Set the response type to JSON
		$response = $app->response();
		$response['Content-Type'] = 'application/json';

		// Connect to mongoDB
		try {
			$db = connectToDb();
			$exercises = $db->exercises;
			$cursor = $exercises->find(array('username' => $username));

			$userExercises = array();
			foreach ($cursor as $doc) {
				// Extract the id into plain string instead of object
				$doc["_id"] = $doc["_id"]->{'$id'};
				$userExercises[] = $doc;
			}

			echo '{ "error" : false, "exercises" : '.json_encode($userExercises).' }';
		} catch (Exception $e) {
			echo '{"error":{"message":'. $e->getMessage() .'}}';
		}
	}
});

$app->run();

function connectToDb() {
	// connect
	$m = new Mongo();
	// select a database
	return $m->learneq;
}

?>