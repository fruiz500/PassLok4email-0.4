﻿//function to test key strength and come up with appropriate key stretching. Based on WiseHash
function keyStrength(pwd,location) {
	var entropy = entropycalc(pwd);

	if(entropy == 0){
		var msg = 'This is a known <span style="color:magenta">bad Password!</span>';
	}else if(entropy < 20){
		var msg = '<span style="color:magenta">Terrible!</span>';
	}else if(entropy < 40){
		var msg = '<span style="color:red">Weak!</span>';
	}else if(entropy < 60){
		var msg = '<span style="color:orange">Medium</span>';
	}else if(entropy < 90){
		var msg = '<span style="color:lime">Good!</span>';
	}else if(entropy < 120){
		var msg = '<span style="color:blue">Great!</span>';
	}else{
		var msg = '<span style="color:cyan">Overkill  !!</span>';
	}

	var iter = Math.max(1,Math.min(20,Math.ceil(24 - entropy/5)));			//set the scrypt iteration exponent based on entropy: 1 for entropy >= 120, 20(max) for entropy <= 20

	var seconds = time10/10000*Math.pow(2,iter-8);			//to tell the user how long it will take, in seconds
	var msg = 'Password strength: ' + msg + '<br>Up to ' + Math.max(0.01,seconds.toPrecision(3)) + ' sec. to process';
	if(location == 'pwd'){
		keyMsg.innerHTML = msg
	}else if(location == 'decoy'){
		decoyInMsg.innerHTML = msg
	}
	return iter
};

//takes a string and calculates its entropy in bits, taking into account the kinds of characters used and parts that may be in the general wordlist (reduced credit) or the blacklist (no credit)
function entropycalc(pwd){

//find the raw Keyspace
	var numberRegex = new RegExp("^(?=.*[0-9]).*$", "g");
	var smallRegex = new RegExp("^(?=.*[a-z]).*$", "g");
	var capRegex = new RegExp("^(?=.*[A-Z]).*$", "g");
	var base64Regex = new RegExp("^(?=.*[/+]).*$", "g");
	var otherRegex = new RegExp("^(?=.*[^a-zA-Z0-9/+]).*$", "g");

	pwd = pwd.replace(/\s/g,'');										//no credit for spaces

	var Ncount = 0;
	if(numberRegex.test(pwd)){
		Ncount = Ncount + 10;
	}
	if(smallRegex.test(pwd)){
		Ncount = Ncount + 26;
	}
	if(capRegex.test(pwd)){
		Ncount = Ncount + 26;
	}
	if(base64Regex.test(pwd)){
		Ncount = Ncount + 2;
	}
	if(otherRegex.test(pwd)){
		Ncount = Ncount + 31;											//assume only printable characters
	}

//start by finding words that might be on the blacklist (no credit)
	var pwd = reduceVariants(pwd);
	var wordsFound = pwd.match(blackListExp);							//array containing words found on the blacklist
	if(wordsFound){
		for(var i = 0; i < wordsFound.length;i++){
			pwd = pwd.replace(wordsFound[i],'');						//remove them from the string
		}
	}

//now look for regular words on the wordlist
	wordsFound = pwd.match(wordListExp);									//array containing words found on the regular wordlist
	if(wordsFound){
		wordsFound = wordsFound.filter(function(elem, pos, self) {return self.indexOf(elem) == pos;});	//remove duplicates from the list
		var foundLength = wordsFound.length;							//to give credit for words found we need to count how many
		for(var i = 0; i < wordsFound.length;i++){
			pwd = pwd.replace(new RegExp(wordsFound[i], "g"),'');									//remove all instances
		}
	}else{
		var foundLength = 0;
	}

	pwd = pwd.replace(/(.+?)\1+/g,'$1');								//no credit for repeated consecutive character groups

	if(pwd != ''){
		return (pwd.length*Math.log(Ncount) + foundLength*Math.log(wordLength + blackLength))/Math.LN2
	}else{
		return (foundLength*Math.log(wordLength + blackLength))/Math.LN2
	}
}

//take into account common substitutions, ignore spaces and case
function reduceVariants(string){
	return string.toLowerCase().replace(/[óòöôõo]/g,'0').replace(/[!íìïîi]/g,'1').replace(/[z]/g,'2').replace(/[éèëêe]/g,'3').replace(/[@áàäâãa]/g,'4').replace(/[$s]/g,'5').replace(/[t]/g,'7').replace(/[b]/g,'8').replace(/[g]/g,'9').replace(/[úùüû]/g,'u');
}

//a bunch of global variables. The rest of the global variables are flags that are defined right before they are to be used.
//myKey is a 32-byte uint8 array private key deriving from the user's Password, for DH and local encryption. myEmail is what it sounds like (string). myLockbin is the derived public Key. Suffix "bin" means it is binary.
//theirEmail, etc, refers to the sender or recipient at the moment a certain encryption or decryption is taking place. Global variable needed for error handling.
//locDir is an object containing the data that is saved between sessions
var	myKey,
	oldPwdStr,
	myEmail,
	myLockbin,
	myLock,
	myezLock,
	theirEmail,
	theirLock,
	theirLockbin,
	callKey = '',
	locDir = {};

//stretches a password string with a salt string to make a 256-bit Uint8Array Password
function wiseHash(pwd,salt){
	var iter = keyStrength(pwd,false),
		secArray = new Uint8Array(32),
		keyBytes;
	if(salt.length == 43) iter = 1;								//random salt: no extra stretching needed
	scrypt(pwd,salt,iter,8,32,0,function(x){keyBytes=x;});
	for(var i=0;i<32;i++){
			secArray[i] = keyBytes[i]
	}
	return secArray
}

//returns milliseconds for 10 scrypt runs at iter=10 so the user can know how long wiseHash will take; called at the end of body script
function hashTime10(){
	var before = Date.now();
	for (var i=0; i<10; i++){
		scrypt('hello','world',10,8,32,0,function(){});
	}
	return Date.now() - before
}

//makes the DH public string of a DH secret key array. Returns a base64 string
function makePubStr(sec){
	var pub = nacl.box.keyPair.fromSecretKey(sec).publicKey;
	return nacl.util.encodeBase64(pub).replace(/=+$/,'')
}

//Diffie-Hellman combination of a DH public key array and a DH secret key array. Returns Uint8Array
function makeShared(pubstr,sec){
	var	pub = nacl.util.decodeBase64(pubstr);
	return nacl.box.before(pub,sec)
}

//makes the DH public key (Montgomery) from a published Lock, which is a Signing public key (Edwards)
function convertPubStr(Lock){
	var pub = nacl.util.decodeBase64(Lock);
	return nacl.util.encodeBase64(ed2curve.convertPublicKey(pub)).replace(/=+$/,'')
}

//stretches nonce to 24 bytes
function makeNonce24(nonce){
	var	result = new Uint8Array(24);
	for(i=0;i<nonce.length;i++){result[i] = nonce[i]};
	return result
}

//encrypt string with a symmetric key
function symEncrypt(plainstr,nonce24,symKey){
	var plain = nacl.util.decodeUTF8(plainstr),
		cipher = nacl.secretbox(plain,nonce24,symKey);
	return nacl.util.encodeBase64(cipher).replace(/=+$/,'')
}

needRecrypt = false;
//decrypt string with a symmetric key
function symDecrypt(cipherstr,nonce24,symKey,isDecoy){
	try{															//this may fail if the string is corrupted, hence the try
		var cipher = nacl.util.decodeBase64(cipherstr);
	}catch(err){
		readMsg.innerHTML = "This encrypted message seems to be corrupted or incomplete";
		throw('decodeBase64 failed')
	}
	var	plain = nacl.secretbox.open(cipher,nonce24,symKey);
	  if(!plain){													//failed, try old password
	  	  if(!isDecoy){
			if(oldPwdStr){
				var oldKeySgn = nacl.sign.keyPair.fromSeed(wiseHash(oldPwdStr,myEmail)).secretKey,
					oldKey = ed2curve.convertSecretKey(oldKeySgn);
				plain = nacl.secretbox.open(cipher,nonce24,oldKey);
				if(!plain){
					failedDecrypt('old')
				}else{
					needRecrypt = true							//record the fact that a new Password is being used
				}
			}else{
				failedDecrypt('new')							//this will open the old Password dialog
			}
	     }else{													//if doing a decoy decryption, don't ask for a new password
	  		failedDecrypt('decoy')
	     }
	  }
	return nacl.util.encodeUTF8(plain)
}

//takes appropriate UI action if decryption fails
function failedDecrypt(marker){
	if(marker == 'new'){
		$('#oldKeyScr').dialog("open");
	}else if(marker == 'old'){
		if(typeof(readScr) != "undefined"){
			readMsg.innerHTML = 'The old Password has not worked either. Try resetting the exchange';
			resetSpan.style.display = '';
		}else if(typeof(composeScr) != "undefined"){
			composeMsg.innerHTML = 'The old Password has not worked either. Try resetting the exchange with the affected recipient';
			if(composeRecipientsBox.innerHTML.split(', ').length < 2) resetSpan2.style.display = '';				//display this only if one recipient
		}
	}else if(marker == 'readonce'){
		restoreTempLock();
		readMsg.innerHTML = 'Read-once messages can be decrypted <em>only once</em>';
		resetSpan.style.display = '';
		callKey = ''
	}else if(marker == 'signed'){
		restoreTempLock();
		readMsg.innerHTML = 'Decryption has Failed. Please check your Password';
		callKey = ''
	}else if(marker == 'idReadonce'){
		restoreTempLock();
		readMsg.innerHTML = 'Nothing found for you, or you are trying to decrypt a Read-once message for the 2nd time';
		resetSpan.style.display = '';
		callKey = ''
	}else if(marker == 'idSigned'){
		restoreTempLock();
		readMsg.innerHTML = 'No message found for you';
		callKey = ''
	}else if(marker == 'decoy'){
		readMsg.innerHTML = 'Hidden message not found';
		callKey = ''
	}else{
		restoreTempLock();
		readMsg.innerHTML = 'Decryption has Failed';
		callKey = ''		
	}
	throw('decryption failed')
}

//restores the original Lock if unlocking from a new Lock fails
function restoreTempLock(){
	if(theirEmail && tempLock){
		locDir[theirEmail][0] = tempLock;
		tempLock = '';
		storeData(theirEmail)
	}
}

//Alphabets for base conversion. Used in making and reading the ezLock format
var BASE36 = '0123456789abcdefghijkLmnopqrstuvwxyz';										//capital L so it won't be mistaken for 1
var BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
//changes the base of a number. inAlpha and outAlpha are strings containing the base code for the original and target bases, as in '0123456789' for decimal
//adapted from http://snippetrepo.com/snippets/bignum-base-conversion, by kybernetikos
function changeBase(number, inAlpha, outAlpha, isLock) {
	var targetBase = outAlpha.length,
		originalBase = inAlpha.length;
    var result = "";
    while (number.length > 0) {
        var remainingToConvert = "", resultDigit = 0;
        for (var position = 0; position < number.length; ++position) {
            var idx = inAlpha.indexOf(number[position]);
            if (idx < 0) {
                throw new Error('Symbol ' + number[position] + ' from the'
                    + ' original number ' + number + ' was not found in the'
                    + ' alphabet ' + inAlpha);
            }
            var currentValue = idx + resultDigit * originalBase;
            var remainDigit = Math.floor(currentValue / targetBase);
            resultDigit = currentValue % targetBase;
            if (remainingToConvert.length || remainDigit) {
                remainingToConvert += inAlpha[remainDigit];
            }
        }
        number = remainingToConvert;
        result = outAlpha[resultDigit] + result;
    }

	//add leading zeroes in Locks
	if(isLock){
		if(targetBase == 64){
			while(result.length < 43) result = 'A'+ result;
		} else if (targetBase == 36){
			while(result.length < 50) result = '0'+ result;
		}
	}
    return result;
}