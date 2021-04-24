const express = require('express');
const app = express();
const path = require(`path`);
const bodyParser = require('body-parser');
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

const BOAT = "boat"
const LOAD = "load"
var address = "https://assignment4-311302.wn.r.appspot.com";
let date= new Date();

function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
	
}



/* ------------- Begin Boat Model Functions ------------- */
function post_Boat(name, type, length){
    var key = datastore.key(BOAT);
	const new_Boat = {"name": name, "type": type, "length": length, "loads": new Array()};
	return datastore.save({"key":key, "data":new_Boat}).then(() => {return key});
}

async function get_Boat(key){
	var [boat] = await datastore.get(key);
	if(boat == null){
		return null;
	}
	boat.id = key.id;
	boat = boatSelf(boat);
	boat = boat_loadSelf(boat);
	return boat;
}

function get_Boats(req){
    var q = datastore.createQuery(BOAT).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results.items = entities[0].map(fromDatastore);
			results.items = results.items.map(boatSelf);
			results.items = results.items.map(boat_loadSelf);
            if(entities[1].moreResults !== datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") + "/boats" + "?cursor=" + entities[1].endCursor;
            }
			return results;
		});
}

async function delete_Boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
	var [boat] = await datastore.get(key);
	//empty loads
	
	boat.loads.forEach(async function(loadobj) {
		const loadKey = datastore.key([LOAD, parseInt(loadobj.id,10)]);
		var [load] = await datastore.get(loadKey);
		load.carrier = null;
		await datastore.update({"key":loadKey, "data":load});
	})
	
	//done empty
    return datastore.delete(key);
}

function update_Boat(id,name, type, length){
    const key = datastore.key([BOAT, parseInt(id,10)]);
	const new_Boat = {"name": name, "type": type, "length": length};
	return datastore.update({"key":key, "data":new_Boat}).then(() => {return key});
}

function boatSelf(item){
	 item.self = address +"/boats/" + item.id;
	 return item;
}

function boat_loadSelf(item){
	item.loads.forEach( function(load){
		load.self = address +"/loads/" + load.id;
		
	});
	 return item;
}

async function boat_removeLoad(id,boatKey){
	var [boat] = await datastore.get(boatKey);
	var index =-1;
	var i;
	for (i = 0; i < boat.loads.length; i++) {
		if(boat.loads[i].id == id){
			index = i;
		}
	}
	if(index>-1){
		boat.loads.splice(index,1);
	}
	datastore.save({"key":boatKey, "data":boat});
}

/* ------------- End Boat Model Functions ------------- */

/* ------------- Begin load Model Functions ------------- */
function post_Load(req){
    var key = datastore.key(LOAD);
	var day = ("0" + date.getDate()).slice(-2);
	var month = ("0" + (date.getMonth() + 1)).slice(-2);
	var year = date.getFullYear();
	var formattedDate = month+ "/" + day + "/" + year
	const new_Load = {"volume": req.body.volume, "content": req.body.content, "carrier": null, "creation_date": formattedDate};
	return datastore.save({"key":key, "data":new_Load}).then(() => {return key});
}

async function get_Load(key){
	var [load] = await datastore.get(key);
	if(load == null){
		return null;
	}
	load.id = key.id;
	load = loadSelf(load);
	load = load_boatSelf(load);
	return load;
}

function loadSelf(item){
	 item.self = address +"/loads/" + item.id;
	 return item;
}
function load_boatSelf(item){
	if(item.carrier == null){
		return item;
	}
	 item.carrier.self = address +"/boats/" + item.carrier.id;
	 return item;
}

function get_Loads(req){
    var q = datastore.createQuery(LOAD).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
            results.items = entities[0].map(fromDatastore);
			results.items = results.items.map(loadSelf);
			results.items = results.items.map(load_boatSelf);
            if(entities[1].moreResults !== datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") + "/loads" + "?cursor=" + entities[1].endCursor;
            }
			return results;
		});
}

async function delete_Load(id){
    const key = datastore.key([LOAD, parseInt(id,10)]);
	//remove load from boat
	
	var [load] = await datastore.get(key);
	if(load.carrier != null){
		const boatKey = datastore.key([BOAT, parseInt(load.carrier.id,10)]);
		var [boat] = await datastore.get(boatKey);
		var index =-1;
		var i;
		for (i = 0; i < boat.loads.length; i++) {
			if(boat.loads[i].id == id){
				index = i;
			}
		}
		if(index>-1){
			boat.loads.splice(index,1);
		}
		datastore.save({"key":boatKey, "data":boat});
		
	}
	
	// done remove
    return datastore.delete(key);
}


/* ------------- End load Model Functions ------------- */
/* ------------- Boat Routes -------------------------- */
app.get('/boats', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	var boats = get_Boats(req)
	.then( (boats) => {
        res.status(200).json(boats);
    });
});



app.post('/boats', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	if(!req.body.name || !req.body.type || !req.body.length){
		error = {"Error": "The request object is missing at least one of the required attributes"}
		res.status(400).send(error);
		return;
	}
	else{
	post_Boat(req.body.name, req.body.type, req.body.length)
    .then( key => {get_Boat(key).then(data => {res.status(201).send(data)});
		});
	}
});

app.delete('/boats/:id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const key = datastore.key([BOAT, parseInt(req.params.id,10)]);
	boat = await get_Boat(key);
	if(boat == null){
		error = {"Error": "No boat with this boat_id exists"  }
		res.status(404).send(error);
		return;
	}
	else{
		delete_Boat(req.params.id).then(res.status(204).end());
	}
});

app.patch('/boats/:id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	if(!req.body.name || !req.body.type || !req.body.length){
		error = {"Error": "The request object is missing at least one of the required attributes"}
		res.status(400).send(error);
		return;
	}
	else{
		const key = datastore.key([BOAT, parseInt(req.params.id,10)]);
		boat = await get_Boat(key);
		if(boat == null){
			error = {"Error": "No boat with this boat_id exists"}
			res.status(404).send(error);
			return;
		}else{
			update_Boat(req.params.id,req.body.name, req.body.type, req.body.length).then(key => {get_Boat(key).then(data => {res.status(200).send(data)});
			});
		}
	}
});

app.get('/boats/:id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const key = datastore.key([BOAT, parseInt(req.params.id,10)]);
	boat = await get_Boat(key);
	if(boat == null){
		error = {"Error": "No boat with this boat_id exists"  }
		res.status(404).send(error);
		return;
	}else{
		res.status(200).send(boat);
	}
	
});


/* ------------- Load Routes -------------------------- */

app.post('/loads', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	if(!req.body.volume || !req.body.content){
		error = {"Error": "The request object is missing the required volume or content"}
		res.status(400).send(error);
		return;
	}
	else{
	post_Load(req)
    .then( key => {get_Load(key).then(data => {res.status(201).send(data)});
		});
	}
});

app.get('/loads/:id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const key = datastore.key([LOAD, parseInt(req.params.id,10)]);
	load = await get_Load(key);
	if(load == null){
		error = {"Error": "No load with this load_id exists"  }
		res.status(404).send(error);
		return;
	}else{
		res.status(200).send(load);
	}
	
});

app.get('/loads', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	var loads = get_Loads(req)
	.then( (loads) => {
        res.status(200).json(loads);
    });
});

app.delete('/loads/:id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const key = datastore.key([LOAD, parseInt(req.params.id,10)]);
	load = await get_Load(key);
	if(load == null){
		error = {"Error": "No load with this load_id exists" }
		res.status(404).send(error);
		return;
	}
	else{
		delete_Load(req.params.id).then(res.status(204).end());
	}
});

app.get('/boats/:boat_id/loads', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const boat_key = datastore.key([BOAT, parseInt(req.params.boat_id,10)]);
	[boat] = await datastore.get(boat_key);
	if(boat==null){
		error = {"Error": "The specified boat does not exist" }
		res.status(404).send(error);
		return;
	}
	else{
		formattedBoat = await get_Boat(boat_key);
		res.status(200).json(formattedBoat.loads);
	}
});

app.put('/boats/:boat_id/loads/:load_id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const boat_key = datastore.key([BOAT, parseInt(req.params.boat_id,10)]);
	[boat] = await datastore.get(boat_key);
	const load_key = datastore.key([LOAD, parseInt(req.params.load_id,10)]);
	var [load] = await datastore.get(load_key);
	if(load == null || boat==null){
		error = {"Error": "The specified boat and/or load does not exist" }
		res.status(404).send(error);
		return;
	}
	load.id = load_key.id;
	if(load.carrier != null){
		error = {"Error": "The specified load is already on a boat" }
		res.status(403).send(error);
		return;
	}
	else{
		boat.loads.push({"id": load.id});
		await datastore.update({"key":boat_key, "data":boat});
		load.carrier = {"id": boat_key.id, "name": boat.name};
		await datastore.update({"key":load_key, "data":load});
		res.status(204).end();
	}
});


app.delete('/boats/:boat_id/loads/:load_id', async (req, res) => {
	address = req.protocol + "://" + req.get("host");
	const boat_key = datastore.key([BOAT, parseInt(req.params.boat_id,10)]);
	[boat] = await datastore.get(boat_key);
	const load_key = datastore.key([LOAD, parseInt(req.params.load_id,10)]);
	var [load] = await datastore.get(load_key);
	if(load == null || boat==null){
		error = {"Error": "The specified boat and/or load does not exist" }
		res.status(404).send(error);
		return;
	}
	load.id = load_key.id;
	if(load.carrier == null){
		error = {"Error": "The specified load is not on this boat" }
		res.status(403).send(error);
		return;
	}
	else if(load.carrier.id != boat_key.id){
		error = {"Error": "The specified load is not on this boat" }
		res.status(403).send(error);
		return;
	}
	else{
		await boat_removeLoad(load.id,boat_key);
		load.carrier = null;
		await datastore.update({"key":load_key, "data":load});
		res.status(204).end();
	}
});


// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
var server = app.listen(PORT, () => {
});