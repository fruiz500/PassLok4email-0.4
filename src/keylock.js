﻿//function to test key strength and come up with appropriate key stretching. Based on WiseHash
function keyStrength(pwd,location) {
	var entropy = entropycalc(pwd);

	if(entropy == 0){
		var msg = 'This is a known bad Password!';
		var colorName = 'magenta'
	}else if(entropy < 20){
		var msg = 'Terrible!';
		var colorName = 'magenta'
	}else if(entropy < 40){
		var msg = 'Weak!';
		var colorName = 'red'
	}else if(entropy < 60){
		var msg = 'Medium';
		var colorName = 'darkorange'
	}else if(entropy < 90){
		var msg = 'Good!';
		var colorName = 'green'
	}else if(entropy < 120){
		var msg = 'Great!';
		var colorName = 'blue'
	}else{
		var msg = 'Overkill  !!';
		var colorName = 'cyan'
	}

	var iter = Math.max(1,Math.min(20,Math.ceil(24 - entropy/5)));			//set the scrypt iteration exponent based on entropy: 1 for entropy >= 120, 20(max) for entropy <= 20

	var seconds = time10/10000*Math.pow(2,iter-8);			//to tell the user how long it will take, in seconds
	var msg = 'Password strength: ' + msg + '\r\nUp to ' + Math.max(0.01,seconds.toPrecision(3)) + ' sec. to process';
	var msgName = '';
	if(location == 'pwd'){msgName = 'keyMsg'
	}else if(location == 'oldPwd'){msgName = 'oldKeyMsg'
	}else if(location == 'decoyIn'){msgName = 'decoyInMsg'
	}else if(location == 'decoyOut'){msgName = 'decoyOutMsg'
	}else if(location == 'image'){msgName = 'stegoImageMsg'
	}
	if(msgName){
		document.getElementById(msgName).textContent = msg;
		hashili(msgName,pwd);
		document.getElementById(msgName).style.color = colorName
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

//makes 'pronounceable' hash of a string, so user can be sure the password was entered correctly
var vowel = 'aeiou',
	consonant = 'bcdfghjklmnprstvwxyz',
	hashiliTimer;
function hashili(msgID,string){
	var element = document.getElementById(msgID);
	clearTimeout(hashiliTimer);
	hashiliTimer = setTimeout(function(){
		if(!string.trim()){
			element.innerText += ''
		}else{
			var code = nacl.hash(nacl.util.decodeUTF8(string.trim())).slice(-2),			//take last 4 bytes of the SHA512		
				code10 = ((code[0]*256)+code[1]) % 10000,		//convert to decimal
				output = '';

			for(var i = 0; i < 2; i++){
				var remainder = code10 % 100;								//there are 5 vowels and 20 consonants; encode every 2 digits into a pair
				output += consonant[Math.floor(remainder / 5)] + vowel[remainder % 5];
				code10 = (code10 - remainder) / 100
			}
//	return output
			element.innerText += '\n' + output
		}
	}, 1000);						//one second delay to display hashili
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
function makePub(sec){
	return pub = nacl.box.keyPair.fromSecretKey(sec).publicKey
}

//Diffie-Hellman combination of a DH public key array and a DH secret key array. Returns Uint8Array
function makeShared(pub,sec){
	return nacl.box.before(pub,sec)
}

//makes the DH public key (Montgomery) from a published Lock, which is a Signing public key (Edwards)
function convertPubStr(Lock){
	return ed2curve.convertPublicKey(nacl.util.decodeBase64(Lock))
}

//stretches nonce to 24 bytes
function makeNonce24(nonce){
	var	result = new Uint8Array(24);
	for(i=0;i<nonce.length;i++){result[i] = nonce[i]};
	return result
}

//encrypt string with a symmetric Key, returns a uint8 array
function symEncrypt(plainstr,nonce24,symKey,isCompressed){
	if(!isCompressed || plainstr.match('="data:')){						//no compression if it includes a file
		var plain = nacl.util.decodeUTF8(plainstr)
	}else{
		var plain = LZString.compressToUint8Array(plainstr)
	}
	return nacl.secretbox(plain,nonce24,symKey)
}

//decrypt string (or uint8 array) with a symmetric Key
function symDecrypt(cipherStr,nonce24,symKey,isCompressed){
	if(typeof cipherStr == 'string'){
		var cipher = nacl.util.decodeBase64(cipherStr)
	}else{
		var cipher = cipherStr
	}
	var	plain = nacl.secretbox.open(cipher,nonce24,symKey);					//decryption instruction
	if(!plain) failedDecrypt('key');
	if(!isCompressed || plain.join().match(",61,34,100,97,116,97,58,")){		//this is '="data:' after encoding
		return nacl.util.encodeUTF8(plain)
	}else{
		return LZString.decompressFromUint8Array(plain)
	}
}

//this one escapes dangerous characters, preserving non-breaking spaces
function escapeHTML(str){
	escapeHTML.replacements = { "&": "&amp;", '"': "&quot;", "'": "&#039;", "<": "&lt;", ">": "&gt;" };
	str = str.replace(/&nbsp;/gi,'non-breaking-space')
	str = str.replace(/[&"'<>]/g, function (m){
		return escapeHTML.replacements[m];
	});
	return str.replace(/non-breaking-space/g,'&nbsp;')
}

//mess up all tags except those whitelisted: formatting, images, and links containing a web reference or a file
function safeHTML(string){
	//first mess up attributes with values not properly enclosed within quotes, because Chrome likes to complete those; extra replaces needed to preserve encrypted material
	string = string.replace(/==/g,'double-equal').replace(/<(.*?)=[^"'](.*?)>/g,'').replace(/double-equal/g,'==');
	//now escape every dangerous character; we'll recover tags and attributes on the whitelist later on
	string = escapeHTML(string);
	//make regular expressions containing whitelisted tags, attributes, and origins; sometimes two versions to account for single quotes
	var allowedTags = '(b|i|strong|em|u|strike|sub|sup|blockquote|ul|ol|li|pre|div|span|a|h1|h2|h3|h4|h5|h6|p|pre|table|tbody|tr|td|img|br|wbr|hr|font)',
		tagReg = new RegExp('&lt;(\/?)' + allowedTags + '(.*?)&gt;','gi'),
		allowedAttribs = '(download|style|src|target|name|id|class|color|size|cellpadding|tabindex|type|start|align)',
		attribReg1 = new RegExp(allowedAttribs + '=\&quot;(.*?)\&quot;','gi'),
		attribReg2 = new RegExp(allowedAttribs + '=\&#039;(.*?)\&#039;','gi'),
		allowedOrigins = '(http:\/\/|https:\/\/|mailto:\/\/|#)',
		origReg1 = new RegExp('href=\&quot;' + allowedOrigins + '(.*?)\&quot;','gi'),
		origReg2 = new RegExp('href=\&#039;' + allowedOrigins + '(.*?)\&#039;','gi');
	//recover allowed tags
	string = string.replace(tagReg,'<$1$2$3>');
	//recover allowed attributes
	string = string.replace(attribReg1,'$1="$2"').replace(attribReg2,"$1='$2'");
	//recover file-containing links
	string = string.replace(/href=\&quot;data:(.*?),(.*?)\&quot;/gi,'href="data:$1,$2"').replace(/href=\&#039;data:(.*?),(.*?)\&#039;/gi,"href='data:$1,$2'");
	//recover web links and local anchors
	string = string.replace(origReg1,'href="$1$2"').replace(origReg2,"href='$1$2'");
	return string
}

//detects the presence of data URI scheme and offers to use the safeHTML filter rather than DOMPurify, which removes that content
function decryptSanitizer(string){
	if(string.indexOf('href="data:') == -1){		//check the absence of a link containing data
		var result = DOMPurify.sanitize(string)
	}else{											//otherwise ask the user what to do
		if(confirm('The decrypted material seems to contain binary data, which might lead to unsafe execution in Firefox. If you click OK, it will be preserved, otherwise it will be removed.')){
			var result = safeHTML(string)
		}else{
			var result = DOMPurify.sanitize(string)
		}		
	}
	return result
}

//takes appropriate UI action if decryption fails
function failedDecrypt(marker){
	if(marker == 'new'){
		$('#oldKeyScr').dialog("open");
	}else if(marker == 'old'){
		if(typeof(readScr) != "undefined"){
			readMsg.textContent = 'The old Password has not worked either. Reload the email page and try again';
			resetSpan.style.display = '';
		}else if(typeof(composeScr) != "undefined"){
			composeMsg.textContent = 'The old Password has not worked either. Reload the email page and try again';
			if(composeRecipientsBox.innerHTML.split(', ').length < 2 && onceMode.checked){
				resetSpan2.style.display = '';				//display this only if one recipient
				composeMsg.textContent = 'The old Password has not worked either. Try resetting the exchange with this recipient';
			}
		}
	}else if(marker == 'read-once'){
		restoreTempLock();
		readMsg.textContent = 'Read-once messages can be decrypted only once. You may want to reset the exchange with the button below';
		resetSpan.style.display = '';
		callKey = ''
	}else if(marker == 'signed'){
		restoreTempLock();
		readMsg.textContent = 'Decryption has Failed. Please check your Password';
		callKey = ''
	}else if(marker == 'idReadonce'){
		restoreTempLock();
		readMsg.textContent = 'Nothing found for you, or you are trying to decrypt a Read-once message for the 2nd time\nYou may want to reset the exchange with the button below';
		resetSpan.style.display = '';
		callKey = ''
	}else if(marker == 'idSigned'){
		restoreTempLock();
		readMsg.textContent = 'No message found for you';
		callKey = ''
	}else if(marker == 'decoy'){
		readMsg.textContent = 'Hidden message not found';
		callKey = ''
	}else{
		restoreTempLock();
		readMsg.textContent = 'Decryption has Failed';
		callKey = ''		
	}
	return
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
var base36 = '0123456789abcdefghijkLmnopqrstuvwxyz';										//capital L so it won't be mistaken for 1
var base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
//changes the base of a number. inAlpha and outAlpha are strings containing the base code for the original and target bases, as in '0123456789' for decimal
//adapted from http://snippetrepo.com/snippets/bignum-base-conversion, by kybernetikos
function changeBase(numberIn, inAlpha, outAlpha, isLock) {
	var isWordsIn = inAlpha instanceof RegExp || inAlpha.match(' '),				//detect whether it's words into string, or the opposite
		isWordsOut = outAlpha instanceof RegExp || outAlpha.match(' ');			//could be RegExp or space-delimited
		
	//split alphabets into array
	var alphaIn = isWordsIn ? (inAlpha instanceof RegExp ? inAlpha.toString().slice(1,-2).split('|') : inAlpha.trim().split(' ')) : inAlpha.split(''),
		alphaOut = isWordsOut ? (outAlpha instanceof RegExp ? outAlpha.toString().slice(1,-2).split('|') : outAlpha.trim().split(' ')) : outAlpha.split('');
	
	var targetBase = alphaOut.length,
		originalBase = alphaIn.length;
    var result = [],
		number = isWordsIn ? numberIn.trim().replace(/ +/g,' ').split(' ') : numberIn.split('');
		
	if(isWordsIn){										//convert words into dictionary variants
		for(var i = 0; i < number.length; i++){
			number[i] = reduceVariants(number[i])
		}
	}
	
    while (number.length > 0) {
        var remainingToConvert = [], resultDigit = 0;
        for (var position = 0; position < number.length; ++position) {
            var idx = alphaIn.indexOf(number[position]);
            if (idx < 0) {
				readMsg.textContent = "Word '" + replaceVariants(number[position]) + "' in word Lock not found in dictionary. Please check"
				return false
            }
            var currentValue = idx + resultDigit * originalBase;
            var remainDigit = Math.floor(currentValue / targetBase);
            resultDigit = currentValue % targetBase;
            if (remainingToConvert.length || remainDigit) {
                remainingToConvert.push(alphaIn[remainDigit])
            }
        }
        number = remainingToConvert;
        result.push(alphaOut[resultDigit])
    }
	
	if(isLock){													//add leading zeroes in Locks
		var lockLength = isWordsOut ? 20 : ((targetBase == 36) ? 50 : 43);
		while(result.length < lockLength) result.push(alphaOut[0])
	}
	result.reverse();
	
	if(isWordsOut){											//convert to regular words
		for(var i = 0; i < result.length; i++){
			result[i] = replaceVariants(result[i])
		}
	}

    return isWordsOut ? result.join(' ') : result.join('')
}