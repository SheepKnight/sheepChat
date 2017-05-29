var http = require('http');
var fs = require('fs');
var mysql = require('mysql');
var url = require('url');
var querystring = require('querystring');
var path = require('path');

// Chargement du fichier index.html affiché au client

var server = http.createServer(function(req, res) {
	var page = url.parse(req.url).pathname;
	var params = querystring.parse(url.parse(req.url).query);
	if(page == "/"){

		fs.readFile('./index.html', 'utf-8', function(error, content) {

			res.writeHead(200, {"Content-Type": "text/html"});
			res.end(content);

		});
	
	}else if(page == "/img/" || page == "/img"){
		
		
		if ('img' in params ) {
        
			var img = fs.readFileSync("./img/" + params.img);
			res.writeHead(200, {'Content-Type': 'image/png' });
			res.end(img, 'binary');
			
		}
		
	}else if(page == "/imggrp/" || page == "/imggrp"){
	
		if ('img' in params ) {
        
			var img = fs.readFileSync("./img/grp/" + params.img);
			res.writeHead(200, {'Content-Type': 'image/png' });
			res.end(img, 'binary');
			
		}
	
	}else{
			
		res.writeHead(404);
			
	}

	//var readStream = fs.createReadStream("img");
	//var potato = readStream.pipe(response);
	
});


// Chargement de socket.io

var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket) {
	
	socket.connected = null;
	console.log('Un client est connecté !' + socket.id);
	
	socket.on('disconnect', function(){
		console.log('user disconnected');
	});
	
	socket.on('refreshGrp', refreshGroups);
	//SELECT group_config.parameter, group_config.value FROM `group_config` WHERE group_config.groupId = 
	function refreshGroups(){
		var parameters = {};
		var mySqlClient = mysql.createConnection({host : "localhost", user : "chatClient", password : "PBLyxeMk3FRak3bL", database : "SheepChat"});
		var request = "SELECT `groups`.`name`, `groups`.`id`, `picture`.`pictureName` FROM `groups` INNER JOIN `users_groups` ON `users_groups`.`groupId` = `groups`.`id` AND `users_groups`.`userId` = " + mySqlClient.escape(socket.idSQL) + " INNER JOIN `picture` WHERE `picture`.`id` = `groups`.`pictureId`";
		mySqlClient.query(request, function select(errorSQL, results, fields) {
			if (errorSQL) {
				console.log(errorSQL);
				deny(errorSQL);
				return;
			}else if ( results.length == 0 ) {
			
				//No groups
				socket.emit('setGroups');
			
			}else{
				
				for(i = 0; i < results.length; i++){
					socket.join("grp"+results[i].id);
					results[i].parameters = {};
				}
				
				request = "SELECT `groups`.`id`, `group_config`.`parameter`, `group_config`.`value` FROM `groups` INNER JOIN `users_groups` ON `users_groups`.`groupId` = `groups`.`id` AND `users_groups`.`userId` = " + mySqlClient.escape(socket.idSQL) + " INNER JOIN `group_config` WHERE `group_config`.`id` = `groups`.`id`";
				mySqlClient.query(request, function select(errorSQL_parameters, results_parameters, fields_parameters) {
				
					if (errorSQL) {
						console.log(errorSQL);
						deny(errorSQL);
						return;
					}else{
						parameters = results_parameters;
						//console.log(parameters);
					
					}
					//console.log(parameters);
				});
				console.log(parameters);
				for(i = 0; i < parameters.length; i++){
					results[parameters[i].id].parameters[parameters[i].parameter] = parameters[i].value;
				}
				console.log(parameters);
				socket.emit('setGroups', results);
				socket.groups = results;
			}
			mySqlClient.end();
		});
	}
	
	function deny(error){
		
		socket.emit('access_denied', error);
		console.log("denied.");
		socket.connected = false;
	}
	
	function grant(input){
		
		socket.emit('access_granted');
		socket.pseudo = input.name;
		socket.idSQL = input.id;
		socket.connected = true;
		
	}
	
	socket.on('createGrp', function (input) {
		
		var mySqlClient = mysql.createConnection({host : "localhost", user : "chatClient", password : "PBLyxeMk3FRak3bL", database : "SheepChat"});
		var request = "INSERT INTO `groups`( `name`, `description`, `pictureId`) VALUES (" + mySqlClient.escape(input.grpName) + "," + mySqlClient.escape(input.grpDesc) + "," + 3 + ")";
		console.log(request);
		mySqlClient.query(request, function select(errorSQL, results, fields) {
			if (errorSQL) {
				console.log(errorSQL);
			}else{
				request = "INSERT INTO `users_groups`(`userId`, `groupId`) VALUES (" + socket.idSQL + ", " + results.insertId + " )";
				mySqlClient.query(request, function select(errorSQL, results, fields) {
					if (errorSQL) {
						console.log(errorSQL);
						return;
					}
					else{
						refreshGroups();
					}
				});
			}
		mySqlClient.end();
		});
		
	});
	
	socket.on('identify', function (input) {
		var mySqlClient = mysql.createConnection({host : "localhost", user : "chatClient", password : "PBLyxeMk3FRak3bL", database : "SheepChat"});
		var request = "SELECT * FROM `users` WHERE `password` = " + mySqlClient.escape(input.pwd) + " AND `name` = "+ mySqlClient.escape(input.name);
		mySqlClient.query(request, function select(errorSQL, results, fields) {
			if (errorSQL) {
				console.log(errorSQL);
				deny(errorSQL);
				return;
			}else if ( results.length == 0 ) {
				deny("Wrong password");
			}else{
			
				grant(results[0]);
			
			}
			mySqlClient.end();
		});
	}); 
	socket.on('message', function (message) {
		console.log("Message !"+message.group+message.message)
    	io.sockets.to("grp"+message.group).emit('recieve', {name : socket.pseudo, message : message.message, grp : message.group});
	});
});

server.listen(8080);