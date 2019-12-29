'use strict';

const {Contract} = require('fabric-contract-api');

class PharmanetContract extends Contract {
	
	constructor() {
		// Provide a custom name to refer to this smart contract
		super('org.pharma-network.pharmanet');
		global.manufacturerOrg = 'manufacturer.pharma-network.com';
  		global.distributorOrg = 'distriburtor.pharma-network.com'
  		global.retailerOrg = 'retailer.pharma-network.com'
  		global.transporterOrg = 'transporter.pharma-network.com'
	}
	
	validateInitiator(ctx, initiator) {
    	const initiatorID  =ctx.clientIdentity.trim().getX509Certificate();
    	if(initiatorID.issuer.organizationName.trim() !== initiator)  {
	    	throw new Error('Not authorized to initiate the transaction: ' + initiatorID.issuer.organizationName + ' not authorised to initiate this transaction');
    	}
    }
	
	/* ****** All custom functions are defined below ***** */
	
	// This is a basic user defined function used at the time of instantiating the smart contract
	// to print the success message on console
	async instantiate(ctx) {
		console.log('Pharmanet Smart Contract Instantiated');
	}
	
	async createStudent(ctx, studentId, name, email) {
		// Create a new composite key for the new student account
		const studentKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.student', [studentId]);
		
		// Create a student object to be stored in blockchain
		let newStudentObject = {
			studentId: studentId,
			name: name,
			email: email,
			school: ctx.clientIdentity.getID(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		
		// Convert the JSON object to a buffer and send it to blockchain for storage
		let dataBuffer = Buffer.from(JSON.stringify(newStudentObject));
		await ctx.stub.putState(studentKey, dataBuffer);
		// Return value of new student account created to user
		return newStudentObject;
	}

	/**
	 * register a new distriburtor company on to the network
	 * @param ctx - The transaction context object
	 * @param companyCRN
	 * @param companyName
	 * @param location
	 * @returns newCompanyObj
	 */
	async registerCompany(ctx, companyCRN, companyName, location, organisationRole) {
		const companyKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.company', [companyCRN]);
		const companyId = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.company', [companyCRN+'-'+companyName]);
		let hierarchyKey;
		switch(organisationRole) {
			case 'Manufacturer' : 
					hierarchyKey = 1;
					break;
			case 'Distributor' : 
					hierarchyKey = 2;
					break;
			case 'Retailer' : 
					hierarchyKey = 3;
					break;
			case 'Transporter' : 
					hierarchyKey = 4;
					break;
			default : 
					throw new Error('invalid organisationRole found');
					break;
		}

		let newCompanyObj = {
			companyId : companyId,	
			companyName : companyName,
			location : location,
			organisationRole : organisationRole,
			hierarchyKey : hierarchyKey,
			createdAt: new Date(),
			updatedAt: new Date(),
		};		

		let dataBuffer = Buffer.from(JSON.stringify(newCompanyObj));
		await ctx.stub.putState(companyKey, dataBuffer);
		return newCompanyObj;
	}
	
	/**
	 * register a new drug on to the network
	 *
	 */
	async addDrug(ctx, drugName, serialNo, mfgData, expDate, companyCRN) {
		const productKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.drug', [drugName+'-'+serialNo]);
		const manufacturerKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.manufacturer', [companyCRN]);

		this.validateInitiator(ctx, manufacturerOrg);

		let newDrugObj = {
			productId : productKey,
			drugName : drugName,
			manufacturer : manufacturerKey,
			mfgData : mfgData,
			expDate : expDate,
			owner : manufacturerKey,
			shippment : '',
			createdAt: new Date(),
			updatedAt: new Date(),
		};		

		let dataBuffer = Buffer.from(JSON.stringify(newDrugObj));
		await ctx.stub.putState(productKey, dataBuffer);
		return newDrugObj;
	}

	/**
	 Function to create a new Purchase Order
	 */
	
	async createPO (ctx, buyerCRN, sellerCRN, drugName, quantity) {
		
		//create the keys
		const purchaseKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.purchase-order', [buyerCRN+'-'+drugName]);
		const buyerKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.company', [buyerCRN]);
		const sellerKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.company', [sellerCRN]);

		let buyerBuffer =  await ctx.stub
				.getState(buyerKey)
				.catch(err => console.log(err));
		let buyerObject = JSON.parse(buyerBuffer.toString());


		let sellerBuffer =  await ctx.stub
				.getState(sellerKey)
				.catch(err => console.log(err));
		let sellerObject = JSON.parse(sellerBuffer.toString());


		// Validations Checked starts here 
		// check if the intitator of POis Distributor or Retailer
		if (!(this.validateInitiator(ctx,distributorOrg)) || (this.validateInitiator(ctx,retailerOrg))) {

			throw new Error('Purchase Order can be created by companies belonging to Distributor or Retailer Oraganisation');
		}

		// check if drug transfer takes place in hierarchal manner

		if ( (sellerObject.hierarchyKey - buyerObject.hierarchyKey ) < 1 ) {

			throw new Error('Tranfer of Drug can take place in hierarchal manner only');
		
		} else {

			let newPOObj = {
			poId : purchaseKey,
			drugName : drugName,
			quantity : quantity,
			buyer : buyerKey,
			seller : sellerKey,
			createdAt: new Date(),
			updatedAt: new Date(),
		};		

		let dataBuffer = Buffer.from(JSON.stringify(newPOObj));
		await ctx.stub.putState(purchaseKey, dataBuffer);
		return newPOObj;

		}	
	}

	
	/**
	 * Get a student account's details from the blockchain
	 * @param ctx - The transaction context
	 * @param studentId - Student ID for which to fetch details
	 * @returns
	 */
	async getStudent(ctx, studentId) {
		// Create the composite key required to fetch record from blockchain
		const studentKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.student', [studentId]);
		
		// Return value of student account from blockchain
		let studentBuffer = await ctx.stub
				.getState(studentKey)
				.catch(err => console.log(err));
		return JSON.parse(studentBuffer.toString());
	}
	
	/**
	 * Issue a certificate to the student after completing the course
	 * @param ctx
	 * @param studentId
	 * @param courseId
	 * @param gradeReceived
	 * @param originalHash
	 * @returns {Object}
	 */
	async issueCertificate(ctx, studentId, courseId, gradeReceived, originalHash) {
		let msgSender = ctx.clientIdentity.getID();
		let certificateKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.certificate',[courseId + '-' + studentId]);
		let studentKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.student', [studentId]);
		
		// Fetch student with given ID from blockchain
		let student = await ctx.stub
				.getState(studentKey)
				.catch(err => console.log(err));
		
		// Fetch certificate with given ID from blockchain
		let certificate = await ctx.stub
				.getState(certificateKey)
				.catch(err => console.log(err));
		
		// Make sure that student already exists and certificate with given ID does not exist.
		if (student.length === 0 || certificate.length !== 0) {
			throw new Error('Invalid Student ID: ' + studentId + ' or Course ID: ' + courseId + '. Either student does not exist or certificate already exists.');
		} else {
			let certificateObject = {
				studentId: studentId,
				courseId: courseId,
				teacher: msgSender,
				certId: courseId + '-' + studentId,
				originalHash: originalHash,
				grade: gradeReceived,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			// Convert the JSON object to a buffer and send it to blockchain for storage
			let dataBuffer = Buffer.from(JSON.stringify(certificateObject));
			await ctx.stub.putState(certificateKey, dataBuffer);
			// Return value of new certificate issued to student
			return certificateObject;
		}
	}
	
	/**
	 *
	 * @param ctx
	 * @param studentId
	 * @param courseId
	 * @param currentHash
	 * @returns {Object}
	 */
	async verifyCertificate(ctx, studentId, courseId, currentHash) {
		let verifier = ctx.clientIdentity.getID();
		let certificateKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.certificate', [courseId + '-' + studentId]);
		
		// Fetch certificate with given ID from blockchain
		let certificateBuffer = await ctx.stub
				.getState(certificateKey)
				.catch(err => console.log(err));
		
		// Convert the received certificate buffer to a JSON object
		const certificate = JSON.parse(certificateBuffer.toString());
		
		// Check if original certificate hash matches the current hash provided for certificate
		if (certificate === undefined || certificate.originalHash !== currentHash) {
			// Certificate is not valid, issue event notifying the student application
			let verificationResult = {
				certificate: courseId + '-' + studentId,
				student: studentId,
				verifier: verifier,
				result: 'xxx - INVALID',
				verifiedOn: new Date()
			};
			ctx.stub.setEvent('verifyCertificate', Buffer.from(JSON.stringify(verificationResult)));
			return verificationResult;
		} else {
			// Certificate is valid, issue event notifying the student application
			let verificationResult = {
				certificate: courseId + '-' + studentId,
				student: studentId,
				verifier: verifier,
				result: '*** - VALID',
				verifiedOn: new Date()
			};
			ctx.stub.setEvent('verifyCertificate', Buffer.from(JSON.stringify(verificationResult)));
			return verificationResult;
		}
	}
	
}

module.exports = PharmanetContract;