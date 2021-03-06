'use strict';

/**
 * This is a Node.JS application to add a new student on the network.
 */

const fs = require('fs');
const yaml = require('js-yaml');
const { FileSystemWallet, Gateway } = require('fabric-network');
const helper = require('./contractHelper');	
let gateway;

async function main(studentId, name, email) {

	try {

		const contract = await helper.getContractInstance();

		// Create a new student account
		console.log('.....Create a new Student account');
		const studentBuffer = await contract.submitTransaction('createStudent', studentId, name, email);

		// process response
		console.log('.....Processing Create Student Transaction Response \n\n');
		let newStudent = JSON.parse(studentBuffer.toString());
		console.log(newStudent);
		console.log('\n\n.....Create Student Transaction Complete!');
		return newStudent;

	} catch (error) {

		console.log(`\n\n ${error} \n\n`);
		throw new Error(error);

	} finally {

		// Disconnect from the fabric gateway
		console.log('.....Disconnecting from Fabric Gateway');
		helper.disconnect();

	}
}

main('200', 'Aakash Bansal', 'connect@aakashbansal.com').then(() => {
	console.log('Student account created');
});

module.exports.execute = main;
