
const net = require('net');
const conf = require('./conf.json');
const Parser = require('teltonika-parser-ex');
const binutils = require('binutils64');
const {MongoClient} = require('mongodb');
require ( "dotenv").config();

console.log(process.versions);
const url = process.env.OFFICETRAKER || "mongodb://localhost:27017";

function connectMongo(){	
	const client = new MongoClient(url, { useUnifiedTopology: true });
	
	client.connect();
	return client.db(process.env.mongoDbName);
}
async function main() {
	try {

	console.log("connect to db for collection %s",conf.mongoCollectionRaw);

	const dbn = await connectMongo();
	var col=dbn.collection(conf.mongoCollectionRaw);
	console.log("Col %s %o",conf.mongoCollectionRaw,col);

	const server = net.createServer(function (socket) {
		console.log('client connected')
		let IMEI;
		socket.on('end', function () {
			console.log('client disconnected');
		});
		socket.on('data', (data) => {
			// const buffer = data;
			console.log("received %s data %s",data.length,data.toString('hex'));
			let parser = new Parser(data);
			if (parser.isImei) {
				IMEI= parser.imei;
				console.log("IMEI exist %s imei a %s",parser.isImei,parser.imei);
				socket.write(Buffer.alloc(1, 1));
			} else {
				let avl = parser.getAvl();
				console.log("AWL",avl);
				
				console.log("IMEI IS",IMEI);
				for (i=0;i<avl['records'].length;i++){
					console.log("TimeStamp",avl['records'][i]['timestamp']);
					console.log("GPS",avl['records'][i]['gps']);
					console.log("ioE",avl['records'][i]['ioElements']);
					for(b=0;b<avl['records'][i]['ioElements'].length;b++){
						console.log("ioE r",avl['records'][i]['ioElements'][b]);
					}
				}
				let writer = new binutils.BinaryWriter();
				writer.WriteInt32(avl.number_of_data);
				let response = writer.ByteBuffer;
				socket.write(response);
				let iTimestamp=new Date();
				const result = col.insertOne({iTimestamp: iTimestamp,dlength: data.length, imei: IMEI, avl: avl });
				console.log("inserted at:",iTimestamp);
				
			}
		});
		
		socket.on('drain', data => {
			console.log('Vacio', data);
		});
		socket.on('close', (data) => {
			IMEI='';
			console.log('Close', data);
		});
	});

	server.listen(conf.port);
	console.log('Listening on port:', conf.port);

	}catch (err) {
		console.log(err);
	} finally {
		// dbn.close();
	}
}

main();
