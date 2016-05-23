#!node
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http)
var cards = require('node-of-cards');
app.use('/static', express.static('Resources'));
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});
var users = {}
var nicks = []
var deck = []
var piles = {}
var currentplayer = 0;
var cardnames = {
	A : "Aces", 2 : "Twos", 3 : "Threes", 4 : "Fours",
	5 : "Fives", 6 : "Sixes", 7 : "Sevens", 8 : "Eights",
	9 : "Nines", 0 : "Tens", J : "Jacks", Q : "Queens",
	K : "Kings",
};
piles["discarded"] = []
piles["inplay"] = []
piles["lastmove"] = 0;
piles["currentcard"] = -1;
var passStreak = false;
var lastPlayer = 0;
function shuffleDeck(decks) {
	suits = ['C', 'H', 'S', 'D']
	ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K']
	for(d = 0; d < decks; d++) {
		for(i = 0; i < suits.length; i++) {
			for(j = 0; j < ranks.length; j++) {
				deck.push(ranks[j]+suits[i]);
			}
		}
	}
	deck.sort(function(a, b) { return 0.5-Math.random(); });
	return deck;
}
io.on('connection', function (socket) {
	function changePlayer() {
		nickname = nicks[currentplayer];
		id = users[nickname]["id"];
		io.to(id).emit('command', 'your move');
		io.to(id).emit('chat message', '<b><i>Your move</i></b>');
		for(i = 0; i < nicks.length; i++) {
			if(i != currentplayer) {
				name = nicks[i];
				id = users[name]["id"];
				io.to(id).emit('chat message', "<b><i>"+nickname + " to move</i></b>");
			}
		}
	}
	socket.on('chat message', function(msg){
		socket.broadcast.emit('chat message', msg);
	});
	socket.on('intro', function(nickname) {
		console.log("nicks present: " + JSON.stringify(nicks));
		for(var i = 0; i < nicks.length; i++) {
			if(nicks[i] != nickname)
				socket.emit('chat message', "<i>"+nicks[i]+" is present</i>");
		}
		socket.broadcast.emit('chat message', "<i>"+nickname+" joined</i>");
		if(!(nickname in users)) {
			users[nickname] = {};
			piles[nickname] = [];
			nicks.push(nickname);
			console.log("users: " + JSON.stringify(users));
		} else {
			socket.emit('get pile', piles[nickname]);
			socket.emit('chat message', "Welcome back to your old game!");
		}
		users[nickname]["id"] = socket.id;
	});
	socket.on('start game', function() {
		io.emit('command', 'current status', 0);
		deck = shuffleDeck(1);
		nickindex = 0;
		for(i = 0; i < nicks.length; i++) {
			nickname = nicks[i];
			piles[nickname] = [];
		}
		while(deck.length > 0) {
			nickname = nicks[nickindex]
			card = deck.pop();
			if(card == 'AS') {
				currentplayer = nickindex;
			}
			piles[nickname].push(card);
			nickindex = (nickindex+1)%nicks.length;
		}
		for(i = 0; i < nicks.length; i++) {
			nickname = nicks[i];
			id = users[nickname]["id"]
			io.to(id).emit('get pile', piles[nickname]);
		}
		changePlayer();
		console.log("current player is: " + nicks[currentplayer]);
		console.log("piles: " + JSON.stringify(piles));
	});
	socket.on('play', function(move) {
		if(move.player != nicks[currentplayer]) {
			console.log("Move was by: " + move.player)
			console.log("Current player is: " + nicks[currentplayer]);
			console.log("Error");
			socket.emit('chat message', "<b>Not your turn</b>");
			changePlayer();
			return
		} else if(move.num == 0) {
			console.log("No cards played");
			console.log("Error");
			socket.emit('chat message', 'Please play some cards in play area');
			changePlayer();
			return
		}
		if(piles.currentcard == -1) {
			piles.currentcard = move.card;
		} else if(move.card != piles.currentcard) {
			console.log("Played card was: " + move.card);
			console.log("Current card is: " + piles.currentcard);
			console.log("Error");
			socket.emit('chat message', "<b>You can only play " + piles.currentcard + "</b>");
			changePlayer();
			return
		}
		passStreak = false;
		socket.broadcast.emit('chat message', "<i>"+move.player+" played "+move.num+" "+cardnames[move.card]+"</i>");
		socket.emit('chat message', "<i>You played "+move.num+" "+cardnames[move.card]+"</i>");
		for(i = 0; i < move.num; i++) {
			piles.inplay.push(move.pile[i])
			tempid = piles[move.player].indexOf(move.pile[i])
			piles[move.player].splice(tempid, 1);
		}
		piles.lastmove = move.num;
		lastPlayer = currentplayer;
		currentplayer = (currentplayer+1)%nicks.length;
		socket.emit('command', 'move accepted');
		io.emit('command', 'current status', piles.lastmove);
		changePlayer();
	});
	socket.on('pass', function(nickname) {
		if(nickname != nicks[currentplayer]) {
			console.log("Move was by: " + move.player)
			console.log("Current player is: " + nicks[currentplayer]);
			console.log("Error");
			socket.emit('chat message', "<b>Not your turn</b>");
			changePlayer();
			return
		}
		passStreak = true;
		if(nicks[lastPlayer] == nickname) {
			while(piles["inplay"].length > 0) {
				piles["discarded"].push(piles["inplay"].pop());
			}
			piles.currentcard = -1;
			currentplayer = lastPlayer;
			changePlayer();
			piles.lastmove = 0;
			socket.broadcast.emit('chat message', "<i>"+nickname+" passed, discarding the current cards</i>");
			socket.emit('chat message', "<i>You passed, discarding the current cards</i>");
			io.emit('command', 'move accepted');
			console.log('Cards discarded');
			console.log("piles: " + JSON.stringify(piles));
		} else {
			socket.broadcast.emit('chat message', "<i>"+nickname+" passed</i>");
			socket.emit('chat message', "<i>You passed</i>");
			currentplayer = (currentplayer+1)%nicks.length;
			changePlayer();
		}
	});
	socket.on('open card', function(move) {
		if(move.player != nicks[currentplayer]) {
			console.log("Move was by: " + move.player)
			console.log("Current player is: " + nicks[currentplayer]);
			console.log("Error");
			socket.emit('chat message', "<b>Not your turn</b>");
			changePlayer();
			return
		}
		move.index = parseInt(move.index);
		if(move.index > piles.lastmove) {
			console.log("Error");
			socket.emit('chat message', "<b>You are cheating</b>");
			changePlayer();
			return
		}
		openable = piles["inplay"].length - piles.lastmove;
		card = piles["inplay"][openable + move.index];
		if(!card) {
			console.log("BIG ERROR");
			return
		}
		console.log("card is: " + card);
		var data = {};
		data.from = move.index;
		data.to = card;
		io.emit('command', 'opened', data);
		console.log("currentcard is: " + piles.currentcard);
		if(card[0] == piles.currentcard) {
			socket.broadcast.emit('chat message', "<i>Opened card is correct, "+move.player+" has to take up the pile</i>");
			socket.emit('chat message', "<i>Opened card is correct, You have to take up the pile</i>");
			while(piles["inplay"].length > 0) {
				piles[move.player].push(piles["inplay"].pop());
			}
			socket.emit('get pile', piles[move.player]);
			currentplayer = lastPlayer;
			changePlayer();
		} else {
			last = nicks[lastPlayer];
			for(i = 0; i < nicks.length; i++) {
				if(i != lastPlayer) {
					name = nicks[i];
					id = users[name]["id"];
					io.to(id).emit('chat message', "<i>Opened card is incorrect, "+nicks[lastPlayer]+" has to take up the pile</i>");
				}
			}
			id = users[last]["id"];
			io.to(id).emit('chat message', "<i>Opened card is incorrect, You have to take up the pile</i>");
			while(piles["inplay"].length > 0) {
				piles[last].push(piles["inplay"].pop());
			}
			io.to(id).emit('get pile', piles[last]);
			for(i = 0; i < nicks.length; i++) {
				if(nicks[i] == move.player) {
					break;
				}
			}
			currentplayer = i;
			changePlayer();
		}
		piles.currentcard = -1;
		piles.lastmove = 0;
		setTimeout(function() {
			io.emit('command', 'current status', 0);
		}, 1200);
	});

});

http.listen(3000, function() {
	console.log("listening on 3000")
});
