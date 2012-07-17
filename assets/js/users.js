var App = App || {};

App.UserManager = Backbone.Model.extend({
	defaults : {
		username : null,
		access_token : null
	},
	
	initialize : function () {
		App.vent.bind("userRegistered", this.onUserRegistered, this);
		this.login();
	},

	onUserRegistered : function () {
		this.login();
	},

	load : function () {
		this.set({
			username : $.cookie('username'),
			access_token : $.cookie('access_token')
		});
	},

	isLoggedIn : function () {
		return Boolean(this.get("username") && this.get("access_token"));
	},

	login : function () {
		this.load(); // Copy the new cookie information into the user manager
		if(this.isLoggedIn()) {
			App.vent.trigger("userLoggedIn");
		} // Activate the functions that retreive the user eq rules and exercises.
	},

	logout : function () {
		App.vent.trigger("userLoggingOut"); // Activate the functions that save the user eq rules and exercises if needs be.
		this.set({
			username : null,
			access_token : null
		});
	}
});

App.UserManagerView = Backbone.View.extend({

	events : {
		"click #userManagerLoginBtn" : "onLoginBtnPress",
		"click #userManagerRegisterBtn" : "onRegisterBtnPress",
		"click #userManagerLogoutBtn" : "onLogoutBtnPress"
	},

	initialize : function () {
		this.model.on("change", this.onChangeUserState, this);
		this.onChangeUserState(); // Called as user may already be logged in.
	},

	onChangeUserState : function () {
		if (this.model.isLoggedIn()){
			this.$("#userManagerBtnText").text(this.model.get("username"));
			this.$("#loginDropdown").hide();
			this.$("#logoutDropdown").show();		
		} else {
			this.$("#userManagerBtnText").text("Login");
			this.$("#logoutDropdown").hide();
			this.$("#loginDropdown").show();		
		}
	},

	onRegisterBtnPress : function (e) {
		e.preventDefault();
		e.stopPropagation();

		App.userRegistrationView.render();
	},

	onLoginBtnPress : function (e) {
		var $username = this.$("#loginUsername"),
			$password = this.$("#loginPassword"),
			self = this;

		e.preventDefault();
		e.stopPropagation();

		this.removeErrors();

		if ($username.val().length === 0) {
			this.addError($username, "Please enter your username.");
		}

		if ($password.val().length === 0) {
			this.addError($password, "Please enter your password.");
		}

		if ($username.val().length + $password.val().length !== 0) {
			// Try to login
			$.ajax({	
				url : 'api/login',
				type : "POST",

				data : JSON.stringify({
					"username" : $username.val(),
					"password" : $password.val()
				}),

				contentType : "application/json",
				dataType : "json",
				processData : false,

				success : function (data) {
					var username = self.$("#registerUsername").val();

					if (data.error) {
						if (data.error.type !== 2) { // If we have a user/pass specific error 
							$inputElem = (data.error.type === 0 ? $username : $password);
							self.addError($inputElem, data.error.message);
						} else { // We have a general error, display above the login button.
							self.$("#loginGeneralError").text(data.error.message).show();
						}
					} else {
						self.model.login();
						self.$el.removeClass("open");
					}
				},

				failure : function (data) {
					// We have a general error, display above the login button.
					this.$("#loginGeneralError").text("UH OH! We hit a problem. Please try again later.").show();
				}
			});
		}
	},

	onLogoutBtnPress : function (e) {
		e.preventDefault();
		e.stopPropagation();

		this.model.logout();
		this.$el.removeClass("open");

		// Tell server we're logging out - this deletes the cookies
		$.get("api/logout", function () {});
	},

	removeErrors : function () {
		this.$(".control-group").removeClass("error").find("p").addClass("hide").text("");
		this.$("#loginGeneralError").hide().text("");
	},

	addError : function ($inputElem, msg) {
		$inputElem.parent().addClass("error").find("p").removeClass("hide").text(msg);
	}
});
