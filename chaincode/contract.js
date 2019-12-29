'use strict';

const {Contract} = require('fabric-contract-api');

class PharmanetContract extends Contract {
	
	constructor() {
		// Provide a custom name to refer to this smart contract
		super('org.pharma-network.pharmanet');
		global.manufacturerOrg = 'manufacturer.pharma-network.com';
  		global.distributorOrg = 'distriburtor.pharma-network.com';
  		global.retailerOrg = 'retailer.pharma-network.com';
  		global.transporterOrg = 'transporter.pharma-network.com';
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

		//this.validateInitiator(ctx, manufacturerOrg);

		let newDrugObj = {
			productId : productKey,
			drugName : drugName,
			manufacturer : manufacturerKey,
			mfgData : mfgData,
			expDate : expDate,
			owner : manufacturerKey,
			shippment : [],
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

		try {
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
				
			let newPOObj = {
				poId : purchaseKey,
				drugName : drugName,
				quantity : quantity,
				buyer : buyerKey,
				seller : sellerKey,
				createdAt: new Date(),
				updatedAt: new Date()
			};	

			let dataBuffer = Buffer.from(JSON.stringify(newPOObj));
			await ctx.stub.putState(purchaseKey, dataBuffer);
			return newPOObj;
		} catch(err) {
			let result = {
				error : err
			};
			return result;
		}
	}

	async retailDrug(ctx, drugName, serialNo, retailerCRN, customerAadhar) {
		
		//check the intiator of the tx is retailer
		//this.validateInitiator(ctx, retailerOrg);

		const productKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.drug', [drugName+'-'+serialNo]);
		const retailerKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.company', [retailerCRN]);
		// fetch the drug with the respective product key

		let assetBuffer = await ctx.stub
				.getState(productKey)
				.catch(err => console.log(err));
			

		let assetObject = JSON.parse(assetBuffer.toString());

		// change the ownership with the drug 
		assetObject.owner = customerAadhar;
		//push the new key to  the shipment list of Drug object
		assetObject.shipment = retailerKey;
		let dataBuffer = Buffer.from(JSON.stringify(assetObject));
		await ctx.stub.putState(productKey, dataBuffer);
		return assetObject;


	}

	async viewHistory(ctx, drugName, serialNo) {

		//create the key for the product whose transaction history needs to be traced
		const productKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.drug', [drugName+'-'+serialNo]);

		//return the history as per the product key
		return await ctx.stub.getHistoryForKey(productKey);

	}
	
	async viewDrugCurrentState (ctx, drugName, serialNo) {

		const productKey = ctx.stub.createCompositeKey('org.pharma-network.pharmanet.drug', [drugName+'-'+serialNo]);
		let productBuffer= await ctx.stub.getState(productKey).catch(err => console.log(err));
		let productObject= JSON.parse(productBuffer.toString());
		return productObject;

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
	
	
}

module.exports = PharmanetContract;