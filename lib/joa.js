var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
// For some reason this doesn't work right
XMLHttpRequest.DONE = 4;

/**
 * JOA.js, provides a way to communicate with the backoffice of Munisense using Javascript.<br />
 * Created by Alex Burghardt, https://github.com/aal89<br />
 * license MIT, http://www.opensource.org/licenses/mit-license<br />
 * Project Page: https://github.com/munisense/JOA-js-client<br />
 * Copyright (c) 2016 Munisense<br />
 *
 * @module JOA
 **/
var JOA = (function () {
    "use strict";
    /**
     * A flag to indicate that this JOA object is running in debug mode. Standard value is false.
     * Whenever debugging is set to true the post() method will posts it's data like the JOA
     * debugging form found at: http://joa3.munisense.net/debug/index.php. This is not a flag
     * that is used for debugging purposes of this JOA object, but rather to indicate how to
     * send the data to the backoffice (production or development wise).<br/><br />
     * This flag ought to be set to true if you were to post to http://joa3.munisense.net/debug/.
     *
     * @property JOA.debug
     * @type {Boolean}
     */
    var debug = true;
    /**
     * Represents the current set backoffice url. <br/>
     *
     * @property JOA.url
     * @type {String}
     */
    var url = null;
    /**
     * Special characters used by the JOA protocol. <br/>
     *
     * @property JOA.char
     * @type {Object}
     * @private
     */
    var char = {
        tab: "\u0009",
        eol: "\u000A"
    };
    /**
     * The header object used to construct a valid header for a particular request. <br/><br/>
     * attribute: A header can also contain an optional comma separated list of value-attribute pairs.<br/>
     * attribute.vendor {String}: The 'vendor' attribute is a string containing the assigned vendor name. A vendor field is required.<br/><br/>
     * attribute.hash {Boolean}: The 'hash' attribute is the MD5 hash of the shared secret concatenated with the contents of the full
     * HTTP POST, including the header without a hash attribute. This value is required when using security level 3 or 4.
     * For this attribute a boolean should be given; true to hash the payload and false for not.<br/><br/>
     * attribute.secret {String}: The 'secret' attributes is the clear-text shared secret. This value is required for security level 2.<br/><br/>
     * attribute.time {Boolean}: The 'time' attribute indicates a time request. It expects a boolean, true if you want a time
     * indication in the response or false if you don't want a time indication.<br/><br/>
     * gatewayIdentifier: The gateway identifier is a 32bit value formatted as an IP address.
     * This IP address will not be the address of the sending node or the backoffice, but
     * a virtual identifier assigned to this device. The address will be an address in the private range
     * defined in RFC1918.<br/><br/>
     *
     * @property JOA.header
     * @type {Object}
     @example
     {
        attribute: {
            vendor: "debug4",
            hash: true,
            secret: "simple_secret",
            time: true
        },
        gatewayIdentifier: "12.34.56.78"
        }
     */
    var header = {
        attribute: {
            vendor: null,
            hash: null,
            secret: null,
            time: null
        },
        gatewayIdentifier: null
    }, protocolVersion = "MuniRPCv2:";
    /**
     * A counter to be used for message id's. <br/>
     *
     * @property JOA.messageId
     * @type {Integer}
     * @private
     */
    var messageId = 0;
    /**
     * An object to be used as an enumerator for message types. <br/>
     *
     * @property JOA.messageType
     * @type {Object}
     * @private
     */
    var messageType = {
        ZCLReport: 0,
        ZCLMultiReport: 1,
        ZCLCommand: 2,
        TAZFrame: 3,
        TimeIndication: "t"
    };
    /**
     * An object to be used as an enumerator for message codes. <br/>
     *
     * @property JOA.messageStatus
     * @type {Object}
     * @private
     */
    var messageStatus = {
        200: {
            code: 200,
            text: "OK",
            description: "Message is received and processed."
        },
        480: {
            code: 480,
            text: "Empty Message",
            description: "When there is only an ID and no message type field."
        },
        481: {
            code: 481,
            text: "Invalid ID",
            description: "The format of the ID is not valid."
        },
        482: {
            code: 482,
            text: "Missing ID",
            description: "The message will not be processed due to invalid authorization."
        },
        483: {
            code: 483,
            text: "Invalid Message",
            description: "Type The message type is not valid."
        },
        484: {
            code: 484,
            text: "Invalid Element",
            description: "Count The message does not have the expected amount of fields."
        },
        485: {
            code: 485,
            text: "Incomplete Message",
            description: "Not all fields have values or could be copied from the previous value."
        },
        486: {
            code: 486,
            text: "Invalid Offset",
            description: "The offset value in a MultiReport message is not valid."
        },
        487: {
            nr: 487,
            text: "Invalid Value",
            description: "The value of one of the fields in a message is not valid."
        },
        488: {
            code: 488,
            text: "Not Implemented",
            description: "The message type or feature was not implemented."
        },
        489: {
            code: 489,
            text: "Error processing message",
            description: "The message was correct but could not be processed."
        }
    };
    /**
     * A queue (array) containing all message objects.<br/>
     *
     * @property JOA.messages
     * @type {Array}
     * @private
     */
    var messages = [];
    /**
     * JOA is an object used to communicate with the backoffice of Munisense.
     * This object will be able to construct a (syntactically) valid payload according to the ms-tech-141003-3 specification.
     * Knowledge of the ms-tech-141003-3 document and the ZigBee cluster specification is required. <br /><br />
     * There is no need to 'new' this object as that is being done for you. Usage is through the JOA() object. For
     * an example implementation see 'examples'. All requests made to the backoffice are made asynchronously.<br /><br />
     * Currently this implementation only supports the MuniRPC version 2 protocol (JOA3).
     * Please note that there's no support for ZCLFrame's in a response from the backoffice and security levels 1 and 2 are
     * not supported. <br/><br />
     * ZigBee cluster specification: https://people.ece.cornell.edu/land/courses/ece4760/FinalProjects/s2011/kjb79_ajm232/pmeter/ZigBee%20Cluster%20Library.pdf
     *
     * @class JOA
     * @constructor
     * @param {String} [url=https://joa3.munisense.net] An optional parameter used to set the backoffice url.
     * @return {JOA} An object that can be used to communicate to the backoffice.
     * @example
     JOA("https://joa3.munisense.net/debug/")
     * Initialises the JOA object with the debug interface from the backoffice url. Note: when using the debug interface
     * through this JOA object don't forget to set JOA.debug to true.
     **/
    var JOA = function (url) {
        JOA.url = url || "https://joa3.munisense.net/";
        return this;
    };
    /**
     * Intialises the header fields in one go with an options object.<br/>
     *
     * @param {Object} options Object containing all headers to be set.
     * @method JOA.headers
     * @example
     JOA.headers({
        attribute: {
                vendor: "debug4",
                time: true,
                hash: true,
                secret: "simple_secret"
            },
        gatewayIdentifier: "1.2.80.90"
        });
     **/
    function headers(obj) {
        JOA.header = obj;
    }
    /**
     * Tries to construct a valid header for the current message. <br />
     * Note: valid, in this context, means that all required fields are set and the result
     * header string is constructed according to the specification, no validation is done
     * on the values of the header fields.
     *
     * @param {Function} cb A callback function with an error and a result parameter.
     * @method JOA.parseHeader
     * @private
     * @example
     parseHeader(function (err, header) {
            if (err) {
                console.log(err);
            } else {
                //we got a valid header!
                console.log(header);
            }
        });
     **/
    function parseHeader(cb) {
        var i,
            headerStr = "",
            headerAttributeKeys = Object.keys(header.attribute);
        //gatewayIdentifier cannot be null if it is we fail to construct the header
        if (JOA.header.gatewayIdentifier !== null && JOA.header.gatewayIdentifier.length > 0) {
            //add the protocol and version indication to the header string
            headerStr += protocolVersion;
            //add the gatewayIdentifier
            headerStr += JOA.header.gatewayIdentifier;
            //loop through the attribute object and decide for each key if it has a value, if so we add
            //it to the header string
            for (i = 0; i < headerAttributeKeys.length; i += 1) {
                var attributeKey = headerAttributeKeys[i],
                    attributeValue = JOA.header.attribute[attributeKey];
                //this if statement looks complicated, but it is not... the left part of this OR
                //statement will check is de value is not null (default) and if so its length is
                //greater than 0, now some of the header fields can also contain a boolean value
                //instead of only a string value. So the right part of the or statement will check
                //for that if we find a boolean value AND it is true we will concatenate it to the
                //header string
                if ((attributeValue !== null && attributeValue.length > 0) || attributeValue) {
                    //if statement for the time header field, if time is set we omit the = char
                    if (attributeKey === "time") {
                        headerStr += ",time";
                        //any other field except for the pre-shared secret and the hash gets added to the
                        //header definition, note: the hash (if enabled) will be added later on
                        //in parsePayload() function.
                    } else if (attributeKey !== "secret" && attributeKey !== "hash") {
                        headerStr += "," + attributeKey + "=" + attributeValue;
                    }
                }
            }
            //at last we're going to add a LF character to mark the header as complete
            headerStr += char.eol;
            //the final check is checking or the final string has a "vendor=" substring in it
            //the vendor header attribute is mandatory
            if (headerStr.indexOf("vendor=") !== -1) {
                //callback with the result, all went well and we constructed a valid header
                cb(null, headerStr);
            } else {
                //no vendor attribute set
                cb("no_vendor_attribute_set", null);
            }
        } else {
            cb("no_gatewayidentifier_set", null);
        }
    }
    /**
     * Will convert all message objects in the queue to a syntactically correct JOA message. <br/>
     *
     * @method JOA.parseMessages
     * @return {Array} An array consisting of all converted JOA messages.
     * @private
     */
    function parseMessages() {
        //setup an temp array which will hold all the new converted messages
        var i,
            j,
            tmp = [];
        //loop through all the messages
        for (i = 0; i < messages.length; i += 1) {
            var convertedMessage = "",
                message = messages[i];
            //before we do anything else we check if the message has a status property, this might indicate
            //that it is a message that is being reused after begin returned from the backoffice, this status
            //property we dont need
            if(message.status) {
                delete message.status;
            }
            //since every message can vary in number of field we need the number of keys in each object
            var messageKeys = Object.keys(message);
            //for each message key add it to the converted message
            for (j = 0; j < messageKeys.length; j += 1) {
                convertedMessage += message[messageKeys[j]] + char.tab;
            }
            //cut off the last tab char and instead add a eol char
            convertedMessage = convertedMessage.slice(0, -1) + char.eol;
            //add it to the temp array
            tmp.push(convertedMessage);
        }
        //return the results as a string instead of an array and remove all the comma occurences
        return tmp.toString().replace(new RegExp(",", "g"), "");
    }
    /**
     * Generates an unique id for this particular instance of JOA. These id's will be used for messages.
     * An id is a 32bit unsigned integer that is being kept track of and incremented each time this function is called.
     * This process is as suggested by the JOA specification.<br/>
     *
     * @method JOA.generateId
     * @return {Integer} An incremented integer to be used as an id.
     * @private
     */
    function generateId() {
        messageId += 1;
        return messageId;
    }
    /**
     * Adds a custom object to the queue.<br/>
     *
     * @method JOA.addObject
     */
    function addObject(obj) {
        messages.push(obj);
    }
    /**
     * Adds a ZCL report to the message queue.
     * The id and messageType fields are automatically being set for you and can be accessed once the method returns.
     * All objects in the queue will be parsed to JOA3 messages upon calling post().
     *
     * @method JOA.addZCLReport
     * @param {String} eui64 A 64bits address defined as an IEEE standard.
     * @param {String} [endpointId=0x0a] When a single message device has multiple sensors of the same type, the endpointId
     * can be used to enumerate the sensors. The range of allowed values is 1 to 239. The best value to use when only
     * a single endpoint is used on a device is: 10 (0x0a). This field is also optional and when null is supplied
     * 0x0a will be used.
     * @param {String} [profileId=0xf100] An optional ZigBee specific field, if null is supplied the default 0xf100 will be used.
     * @param {String} clusterId clusters are an organizational unit of attributes of the same type. For example,
     * all temperature related attributes are defined in clusterid: 1026 (0x0402). All cluster id's must be coordinated
     * with Munisense before usage.
     * @param {String} attributeId Attributes are the most specific fields defining a message. For example, the
     * calibration value in the temperature cluster has an attributeid of 5 (0x005), has a unit in C (celsius) and has
     * a data type int16s (0x29) and is presumed to be delivered with a scale factor of 0.01. Lists of definition are
     * available from ZigBee specifications or vendor specific clusters can be defined coordinated with Munisense.
     * @param {String} dataTypeId Each attribute has a fixed data type. Sending this value is an indication how values
     * submitted should be handled and must be consistent throughout the implementation. Data types are defined in the
     * ZigBee specification.
     * @param {String} timestamp The timestamp is used to indicate the occurreence of a message. This value is a
     * positive numerical value up to 48 bits in size indicating the number of milliseconds since 1970-01-01 00:00:00
     * UTC, not adjusting for daylight savings time or leap seconds.
     * @param {String} value The value is an ASCII representation of the reported value. The datatypeId indicates how
     * a value should be notated:<br />
     * - Integer (0x20-0x27, 0x28-0x2f): The value is numeric and optionally negative using a '-' minues
     * indication in front of the value for signed values.<br />
     * - Floating point (0x38-0x3a): Values are numeric, separating the integral and fractional parts with a '.' dot.<br />
     * - Character/octet string (0x41-0x44): Value starting with one or two bytes indicating the length of the field
     * completely encoded with base64.<br />
     * - Boolean (0x10): 0 for false, 1 for true.<br />
     * - Time (0xe2): This value is a positive numerical value up to 32bits in size indidcating the number of milliseconds
     * since 2000-01-01 00:00:00 UTC, not adjusting for daylight savings time or leap seconds.<br />
     * - Enumerations (0x30-0x31): Numeric value indicating an enumeration.
     * @return {Object} The inserted ZCL report.
     */
    function addZCLReport(eui64, endpointId, profileId, clusterId, attributeId, dataTypeId, timestamp, value) {
        var obj = {
            id: generateId(),
            messageType: messageType.ZCLReport,
            eui64: eui64,
            endpointId: endpointId || "0x0a",
            profileId: profileId || "0xf100",
            clusterId: clusterId,
            attributeId: attributeId,
            dataTypeId: dataTypeId,
            timestamp: timestamp,
            value: value
        };
        messages.push(obj);
        return obj;
    }
    /**
     * Adds a ZCL Multireport to the message queue.
     * The id and messageType fields are automatically being set for you and can be accessed once the method returns.
     * All objects in the queue will be parsed to JOA3 messages upon calling post().
     *
     * @method JOA.addZCLMultiReport
     * @param {String} eui64 A 64bits address defined as an IEEE standard.
     * @param {String} [endpointId=0x0a] When a single message device has multiple sensors of the same type, the endpointId
     * can be used to enumerate the sensors. The range of allowed values is 1 to 239. The best value to use when only
     * a single endpoint is used on a device is: 10 (0x0a). This field is also optional and when null is supplied
     * 0x0a will be used.
     * @param {String} [profileId=0xf100] An optional ZigBee specific field, if null is supplied the default 0xf100 will be used.
     * @param {String} clusterId Clusters are an organizational unit of attributes of the same type. For example,
     * all temperature related attributes are defined in clusterid: 1026 (0x0402). All cluster id's must be coordinated
     * with Munisense before usage.
     * @param {String} attributeId Attributes are the most specific fields defining a message. For example, the
     * calibration value in the temperature cluster has an attributeid of 5 (0x005), has a unit in C (celsius) and has
     * a data type int16s (0x29) and is presumed to be delivered with a scale factor of 0.01. Lists of definition are
     * available from ZigBee specifications or vendor specific clusters can be defined coordinated with Munisense.
     * @param {String} dataTypeId Each attribute has a fixed data type. Sending this value is an indication how values
     * submitted should be handled and must be consistent throughout the implementation. Data types are defined in the
     * ZigBee specification.
     * @param {String} timestamp The timestamp is used to indicate the occurreence of a message. This value is a
     * positive numerical value up to 48 bits in size indicating the number of milliseconds since 1970-01-01 00:00:00
     * UTC, not adjusting for daylight savings time or leap seconds.
     * @param {String} offset The offset in this message type indicates the value between the timestamp and the following
     * values. For each value the offset is added to the timestamp. The offset is in milliseconds. If the offset is a
     * positive value, each value following the first will have a timestamp in the future in respect it previous value.
     * When the offset is negative, each value following the first will have a timestamp in the past in respect it previous value.
     * @param {Array} values An array containing the values in an ASCII representation of the reported values.
     * The datatypeId indicates how a value should be notated:<br />
     * - Integer (0x20-0x27, 0x28-0x2f): The value is numeric and optionally negative using a '-' minues
     * indication in front of the value for signed values.<br />
     * - Floating point (0x38-0x3a): Values are numeric, separating the integral and fractional parts with a '.' dot.<br />
     * - Character/octet string (0x41-0x44): Value starting with one or two bytes indicating the length of the field
     * completely encoded with base64.<br />
     * - Boolean (0x10): 0 for false, 1 for true.<br />
     * - Time (0xe2): This value is a positive numerical value up to 32bits in size indidcating the number of milliseconds
     * since 2000-01-01 00:00:00 UTC, not adjusting for daylight savings time or leap seconds.<br />
     * - Enumerations (0x30-0x31): Numeric value indicating an enumeration.
     * @return {Object} The inserted ZCL Multireport.
     */
    function addZCLMultiReport(eui64, endpointId, profileId, clusterId, attributeId, dataTypeId, timestamp, offset, values) {
        var obj = {
            id: generateId(),
            messageType: messageType.ZCLMultiReport,
            eui64: eui64,
            endpointId: endpointId || "0x0a",
            profileId: profileId || "0xf100",
            clusterId: clusterId,
            attributeId: attributeId,
            dataTypeId: dataTypeId,
            timestamp: timestamp,
            offset: offset,
            //one does not simply pass an array into this message
            //we convert it to a string with the commas replaced by tabs as specified
            //by the protocol
            values: values.toString().replace(new RegExp(",", "g"), char.tab)
        };
        messages.push(obj);
        return obj;
    }
    /**
     * Adds a ZCL command to the message queue.
     * The id and messageType fields are automatically being set for you and can be accessed once the method returns.
     * All objects in the queue will be parsed to JOA3 messages upon calling post().
     *
     * @method JOA.addZCLCommand
     * @param {String} eui64 A 64bits address defined as an IEEE standard.
     * @param {String} [endpointId=0x0a] When a single message device has multiple sensors of the same type, the endpointId
     * can be used to enumerate the sensors. The range of allowed values is 1 to 239. The best value to use when only
     * a single endpoint is used on a device is: 10 (0x0a). This field is also optional and when null is supplied
     * 0x0a will be used.
     * @param {String} [profileId=0xf100] An optional ZigBee specific field, if null is supplied the default 0xf100 will be used.
     * @param {String} clusterId Clusters are an organizational unit of attributes of the same type. For example,
     * all temperature related attributes are defined in clusterid: 1026 (0x0402). All cluster id's must be coordinated
     * with Munisense before usage.
     * @param {String} isClusterSpecific A flag indicating 0 for false or 1 for true to indicate that a submitted
     * command is a ZigBee standard ZCL Command or a command defined for the specific use in a cluster.
     * @param {String} commandId The command id is used to indicate what ZCL Command number is used for the submitted
     * package. For example, a command indicating the switching of a light is CommandId: 0 (0x00) in the On/Off cluster.
     * @param {String} timestamp The timestamp is used to indicate the occurreence of a message. This value is a
     * positive numerical value up to 48 bits in size indicating the number of milliseconds since 1970-01-01 00:00:00
     * UTC, not adjusting for daylight savings time or leap seconds.
     * @param {String} value The value in an ASCII representation of the reported values.
     * @return {Object} The inserted ZCL command.
     */
    function addZCLCommand(eui64, endpointId, profileId, clusterId, isClusterSpecific, commandId, timestamp, value) {
        var obj = {
            id: generateId(),
            messageType: messageType.ZCLCommand,
            eui64: eui64,
            endpointId: endpointId || "0x0a",
            profileId: profileId || "0xf100",
            clusterId: clusterId,
            isClusterSpecific: isClusterSpecific,
            commandId: commandId,
            timestamp: timestamp,
            value: value
        };
        messages.push(obj);
        return obj;
    }
    /**
     * Clears all of the inserted messages. This function will also be invoked when a successful (iff) post() call was
     * made. <br/>
     *
     * @method JOA.clearMessages
     */
    function clearMessages() {
        messages = [];
    }
    /**
     * Returns all the messages in the queue. <br/>
     *
     * @method JOA.getMessages
     * @return {[Object]} An array of Javascript objects.
     */
    function getMessages() {
        return messages;
    }
    /**
     * Gets a sinlge message from the queue. Does not remove the message. <br/>
     *
     * @param id The id of the message.
     * @method JOA.getMessage
     * @return {Object} A message object if one is found, an empty object otherwise.
     */
    function getMessage(id) {
        var i;
        for (i = 0; i < messages.length; i += 1) {
            if (messages[i].id === id) {
                return messages[i];
            }
        }
        return {};
    }
    /**
     * Removes a sinlge message from the queue. <br/>
     *
     * @param id The id of the message to be removed.
     * @method JOA.removeMessage
     * @return {Boolean} True if the message was removed, false otherwise.
     */
    function removeMessage(id) {
        var i;
        for (i = 0; i < messages.length; i += 1) {
            if (messages[i].id === id) {
                var obj = messages[i];
                messages.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    /**
     * Checks wheter or not hashing is enabled in the header attributes.<br />
     *
     * @method JOA.isHashingEnabled
     * @return {Boolean} True if hashing is enabled, the secret set and it's length greater than 0
     * , false otherwise.
     * @private
     **/
    function isHashingEnabled() {
        return JOA.header.attribute.hash &&
            JOA.header.attribute.secret &&
            JOA.header.attribute.secret.length > 0;
    }
    /**
     * Hashes the entire JOA payload with the secret that has been set in the header. <br/>
     *
     * @method JOA.hashPayload
     * @private
     */
    function hashPayload(payload) {
        //we get the first occurence of the eol in the header definition and there
        //we will insert the generated hash header
        var indexOfHashHeader = payload.indexOf(char.eol),
            hash = JOA.md5(JOA.header.attribute.secret + payload),
            //return the new payload with the appended hash header
            payloadWithHash = payload.slice(0, indexOfHashHeader) + ",hash=" + hash + payload.slice(indexOfHashHeader);
        //console.log(JSON.stringify(payloadWithHash));
        return payloadWithHash;
    }
    /**
     * Will construct a syntactically valid JOA payload, essentially this is a wrapper method. First it will
     * parse the JOA headers followed by parsing the messages in the queue. Eventually, if all went well, it
     * will return (trough a callback) a fully parsed JOA payload. If hash is set to true in the header attributes
     * it will generate a hash too and append it to the payload. <br/>
     *
     * @param {Function} cb A callback function with an error and a result parameter.
     * @method JOA.parsePayload
     * @private
     @example
     parsePayload(function (err, payload) {
            if (err) {
                console.log(err);
            } else {
                //we did all the things right! we got a payload
                console.log(payload);
            }
        });
     */
    function parsePayload(cb) {
        parseHeader(function (err, header) {
            if (err) {
                cb(err, null);
            } else {
                //if hash is disabled we will not hash the payload
                if (!JOA.header.attribute.hash) {
                    cb(null, header + parseMessages());
                    //else if the hash is enabled AND the secret is also set we will hash the payload
                } else if (isHashingEnabled()) {
                    cb(null, hashPayload(header + parseMessages()));
                    //in any other cases (which is only when the hash is enabled and no secret is set)
                    //we will return an error
                } else {
                    cb("no_secret_set", null);
                }
            }
        });
    }
    /**
     * Parses the result gotten from the backoffice. It will return an array containing all messages as
     * Javascript objects.<br/>
     *
     * @param {String} str The response as gotton it from the backoffice.
     * @method JOA.parseResponse
     * @return {[Object]} An array containing objects. See example to see the format of the returned array.
     * @private
     */
    function parseResponse(response) {
        var splitResponse = response.split(char.eol),
            tmp = [],
            i,
            j;
        //we loop through all the splitResponse elements except for the last one
        //we splitted on char.eol chars, each line in the respone ends with a eol char
        //even the last one so to ignore the always empty last element of this array
        //we reduce length with 1
        for (i = 0; i < splitResponse.length - 1; i+= 1) {
            var splitResponseMessage = splitResponse[i].split(char.tab);
            var referencedMessagesIds = [];
            //we build an array containing all the referenced message ids in this response message
            //because the first and second elements are always an type and a status code we will
            //set j to 2 as initial value, we skip over those elements (the rest are all referenced ids
            //which we actually need)
            for (j = 2; j < splitResponseMessage.length; j+= 1) {
                referencedMessagesIds.push(splitResponseMessage[j]);
            }
            //now that we got all the data lets start creating the array to return
            //check for the case we have a time attribute if so handle accordingly
            var type = splitResponseMessage[0],
                obj;
            if(type !== "t") {
                obj = {
                    type: type,
                    code: messageStatus[splitResponseMessage[1]],
                    messages: referencedMessagesIds
                };
            } else {
                obj = {
                    type: type,
                    timestamp: splitResponseMessage[1]
                };
            }
            //push the actual object into the tmp array
            tmp.push(obj);
        }
        return tmp;
    }
    /**
     * Gets the status of a message based on a given parsed response. This parsed response should be
     * an array containing all messages as Javascript objects.<br/>
     *
     * @param {Object} message The message (as an object) to check against a response.
     * @param {[Object]} response The response.
     * @method JOA.getMessageStatus
     * @return {Object} An object containing the status of the message in the format in the example.
     * @example
     getMessageStatus(messageObj, respObj);
     Returns:
     {
        nr: 200,
        text: "OK",
        description: "Message is received and processed."
     }
     * @private
     */
    function getMessageStatus(message, response) {
        var i, j,
            defaultStatus = messageStatus[489];
        for (i = 0; i < response.length; i += 1) {
            //were only going to loop through status response messages and not timestamp messages
            if(response[i].type === "s") {
                var messageIds = response[i].messages;
                for (j = 0; j < messageIds.length; j += 1) {
                    if(message.id == messageIds[j]) {
                        return response[i].code;
                    }
                }
                //if messageIds is empty it means it is the most occuring message status from the
                //response, if a status is the occuring in a response all the message ids will be
                //omitted, so we have to save this status to later return this as the default case if a
                //single message id is not found in none of the response objects
                if(messageIds.length === 0) {
                    defaultStatus = response[i].code;
                }
            }
        }
        //return the default status (the most occuring reponse status). Usually this is 200, but it
        //can also be something different in some cases
        return defaultStatus;
    }
    /**
     * Determines all the successful messages in a certain response. All successful messages will also get
     * their status appended to the object.<br/>
     *
     * @param {Object} messages The messages (as an array of objects) to check against a response.
     * @param {[Object]} response The response as gotton it from the backoffice.
     * @method JOA.getSuccessfulMessages
     * @return {[Object]} An array containing all the messages that came back with a 200 (OK) status.
     * @private
     */
    function getSuccessfulMessages(messages, response) {
        var i,
            tmp = [];
        for (i = 0; i < messages.length; i += 1) {
            var msgStatus = getMessageStatus(messages[i], response);
            if(msgStatus.code === 200) {
                messages[i].status = msgStatus;
                tmp.push(messages[i]);
            }
        }
        return tmp;
    }
    /**
     * Determines all the failed messages in a certain response. All failed messages will also get
     * their status appended to the object. <br/>
     *
     * @param {Object} messages The messages (as an array of objects) to check against a response.
     * @param {[Object]} response The response as gotton it from the backoffice.
     * @method JOA.getFailedMessages
     * @return {[Object]} An array containing all the messages that came back with anything other
     * then a 200 (OK) status.
     * @private
     */
    function getFailedMessages(messages, response) {
        var i,
            tmp = [];
        for (i = 0; i < messages.length; i += 1) {
            var msgStatus = getMessageStatus(messages[i], response);
            if(msgStatus.code !== 200) {
                messages[i].status = msgStatus;
                tmp.push(messages[i]);
            }
        }
        return tmp;
    }
    /**
     * Posts a constructed JOA payload to the user given url.<br>
     * Note: this method only resets the message id counter is the object is cleared of
     * all messages, whenever it has message after a post action it will continue to use
     * the current counter.
     *
     * @method JOA.post
     * @param {Object} [options] An options object to use while posting. These options are available:<br>
     * - clear {Boolean}: Set to true when the JOA object should be cleared upon a successful post action.<br>
     * - clearOnlySuccess {Boolean}: Removes all the succes (ack-ed) messages but keeps the failed messages in
     * the message queue, ready to be resent.<br>
     * - resetMessageIdsTo {Integer}: An number to reset the message id counter to whenever the post successfully
     * posts to the backoffice. 0 is default.
     * @param {Function} [cb] A function used to call back to whenever the HTTP post finishes. It has
     * an error, response and messages parameters. The response and messages parameters are objects.
     * The response object consist of a raw and a parsed property. The raw property will output data as
     * it was returned by the backoffice. The parsed property will evaluate the raw data and return
     * Javascript objects, which are easily read. The message object has the same two properties, only
     * the parsed property is also an object. Consisting of success, failed and
     * all properties. They contain the 'ack-ed' messages, 'not ack-ed' messages and an array containing
     * all messages. For an example of this method see 'Examples'.
     * @example
     JOA.post({
        clear: true,
        clearOnlySuccess: true,
        resetMessageIdsTo: 1080
     }, function(err, response, messages) {
            if(err) {
                //something went wrong, the header could of returned an error or
                //the actual request failed.
                console.log(err);
            }
            if(response) {
                //we got a response from the server
                console.log(response);
                //these are the messages that were raw and sent to the backoffice
                console.log(messages.raw);
            }
        });
     */
    function post(options, cb) {
        parsePayload(function (err, payload) {
            if (err) {
                cb(err, null, null);
            } else {
                //make the ajax call
                var http = new XMLHttpRequest(),
                    params = "";
                http.open("POST", JOA.url, true);
                //is debugging enabled, if so change the params and request headers accordingly
                if (JOA.debug) {
                    http.responseType = "document";
                    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    params = "joa3[ip]=0.0.0.0&joa3[url]=https://joa3.munisense.net/&joa3[body]=" + payload;
                } else {
                    http.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    params = payload;
                }

                //call a function when the state changes
                http.onreadystatechange = function () {
                    if (http.readyState === XMLHttpRequest.DONE) {
                        if (http.status === 200) {
                            var messagesRaw = parseMessages(),
                                msgs = getMessages(),
                                //decide what to return based on the debug flag
                                respRaw = JOA.debug ? http.response.getElementsByTagName("pre")[0].innerHTML : http.responseText,
                                respParsed = parseResponse(respRaw),
                                sucmsgs = getSuccessfulMessages(msgs, respParsed),
                                failmsgs = getFailedMessages(msgs, respParsed);
                            //if all went well and the clear param is set to true
                            //we clear the messages and make a callback
                            if(options && options.clear) {
                                clearMessages();
                            }
                            //if the option is set to only clear the success messages, we reset the JOA.messages property
                            //with the failed messages
                            if(options && options.clearOnlySuccess) {
                                messages = failmsgs;
                            }

                            //reset message id counter only when all messages are cleared, otherwise we might
                            //run into duplicate id's
                            if(getMessages().length === 0)
                                messageId = (options && options.resetMessageIdsTo) || 0;
                            if(cb) {
                                cb(null, {raw: respRaw, parsed: respParsed},
                                    {raw: messagesRaw, parsed: {success: sucmsgs, failed: failmsgs, all: msgs}});
                            }
                            //this else block responsibility is only to make a callback, so we can check that in the
                            //else if statement if the function actually exists
                        } else if(cb) {
                            cb({code: http.status, text: http.statusText}, null, null);
                        }
                    }
                };
                http.send(params);
            }
        });
    }
    /**
     * A representation of the object in the format of a parsed JOA payload (see also 'Example'
     * in the JOA specification document).
     * It could also contain errors, if, for example, the header couldn't be contructed this
     * toString() function will output the error message instead of the payload.<br />
     *
     * @method JOA.toString
     * @return {String} A string based representation of a JOA payload.
     **/
    function toString() {
        var ret = null;
        parsePayload(function (err, payload) {
            if (err) {
                ret = err;
            } else {
                ret = payload;
            }
        });
        return ret;
    }
    /**
     * Returns the hash of the current JOA object and it's parsed messages.<br />
     *
     * @method JOA.toHash
     * @return {String} The hash that will be appended to the header definition.
     **/
    function toHash() {
        var ret = null;
        parsePayload(function (err, payload) {
            if (err) {
                ret = err;
            } else if (isHashingEnabled()) {
                //six is the length of ,hash=
                var indexOfHash = payload.indexOf(",hash=") + 6,
                    indexOfLastEOL = payload.indexOf(char.eol);
                ret = payload.substring(indexOfHash, indexOfLastEOL);
            } else {
                ret = "no_hashing_enbaled";
            }
        });
        return ret;
    }
    /**
     * A minized natively approach for Javascript md5 hashing.<br />
     *
     * @method JOA.md5
     * @param {String} s String to be hashed.
     * @return {String} A md5 hashed string.
     **/
    var md5 = function(s){function L(k,d){return(k<<d)|(k>>>(32-d));}function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d){return(x^2147483648^F^H);}if(I|d){if(x&1073741824){return(x^3221225472^F^H);}else{return(x^1073741824^F^H);}}else{return(x^F^H);}}function r(d,F,k){return(d&F)|((~d)&k);}function q(d,F,k){return(d&k)|(F&(~k));}function p(d,F,k){return(d^F^k);}function n(d,F,k){return(F^(d|(~k)));}function u(G,F,aa,Z,k,H,I){G=K(G,K(K(r(F,aa,Z),k),I));return K(L(G,H),F);}function f(G,F,aa,Z,k,H,I){G=K(G,K(K(q(F,aa,Z),k),I));return K(L(G,H),F);}function D(G,F,aa,Z,k,H,I){G=K(G,K(K(p(F,aa,Z),k),I));return K(L(G,H),F);}function t(G,F,aa,Z,k,H,I){G=K(G,K(K(n(F,aa,Z),k),I));return K(L(G,H),F);}function e(G){var Z;var F=G.length;var x=F+8;var k=(x-(x%64))/64;var I=(k+1)*16;var aa=Array(I-1);var d=0;var H=0;while(H<F){Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=(aa[Z]| (G.charCodeAt(H)<<d));H++;}Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=aa[Z]|(128<<d);aa[I-2]=F<<3;aa[I-1]=F>>>29;return aa;}function B(x){var k="",F="",G,d;for(d=0;d<=3;d++){G=(x>>>(d*8))&255;F="0"+G.toString(16);k=k+F.substr(F.length-2,2);}return k;}function J(k){k=k.replace(/rn/g,"n");var d="";for(var F=0;F<k.length;F++){var x=k.charCodeAt(F);if(x<128){d+=String.fromCharCode(x);}else{if((x>127)&&(x<2048)){d+=String.fromCharCode((x>>6)|192);d+=String.fromCharCode((x&63)|128);}else{d+=String.fromCharCode((x>>12)|224);d+=String.fromCharCode(((x>>6)&63)|128);d+=String.fromCharCode((x&63)|128);}}}return d;}var C=Array();var P,h,E,v,g,Y,X,W,V;var S=7,Q=12,N=17,M=22;var A=5,z=9,y=14,w=20;var o=4,m=11,l=16,j=23;var U=6,T=10,R=15,O=21;s=J(s);C=e(s);Y=1732584193;X=4023233417;W=2562383102;V=271733878;for(P=0;P<C.length;P+=16){h=Y;E=X;v=W;g=V;Y=u(Y,X,W,V,C[P+0],S,3614090360);V=u(V,Y,X,W,C[P+1],Q,3905402710);W=u(W,V,Y,X,C[P+2],N,606105819);X=u(X,W,V,Y,C[P+3],M,3250441966);Y=u(Y,X,W,V,C[P+4],S,4118548399);V=u(V,Y,X,W,C[P+5],Q,1200080426);W=u(W,V,Y,X,C[P+6],N,2821735955);X=u(X,W,V,Y,C[P+7],M,4249261313);Y=u(Y,X,W,V,C[P+8],S,1770035416);V=u(V,Y,X,W,C[P+9],Q,2336552879);W=u(W,V,Y,X,C[P+10],N,4294925233);X=u(X,W,V,Y,C[P+11],M,2304563134);Y=u(Y,X,W,V,C[P+12],S,1804603682);V=u(V,Y,X,W,C[P+13],Q,4254626195);W=u(W,V,Y,X,C[P+14],N,2792965006);X=u(X,W,V,Y,C[P+15],M,1236535329);Y=f(Y,X,W,V,C[P+1],A,4129170786);V=f(V,Y,X,W,C[P+6],z,3225465664);W=f(W,V,Y,X,C[P+11],y,643717713);X=f(X,W,V,Y,C[P+0],w,3921069994);Y=f(Y,X,W,V,C[P+5],A,3593408605);V=f(V,Y,X,W,C[P+10],z,38016083);W=f(W,V,Y,X,C[P+15],y,3634488961);X=f(X,W,V,Y,C[P+4],w,3889429448);Y=f(Y,X,W,V,C[P+9],A,568446438);V=f(V,Y,X,W,C[P+14],z,3275163606);W=f(W,V,Y,X,C[P+3],y,4107603335);X=f(X,W,V,Y,C[P+8],w,1163531501);Y=f(Y,X,W,V,C[P+13],A,2850285829);V=f(V,Y,X,W,C[P+2],z,4243563512);W=f(W,V,Y,X,C[P+7],y,1735328473);X=f(X,W,V,Y,C[P+12],w,2368359562);Y=D(Y,X,W,V,C[P+5],o,4294588738);V=D(V,Y,X,W,C[P+8],m,2272392833);W=D(W,V,Y,X,C[P+11],l,1839030562);X=D(X,W,V,Y,C[P+14],j,4259657740);Y=D(Y,X,W,V,C[P+1],o,2763975236);V=D(V,Y,X,W,C[P+4],m,1272893353);W=D(W,V,Y,X,C[P+7],l,4139469664);X=D(X,W,V,Y,C[P+10],j,3200236656);Y=D(Y,X,W,V,C[P+13],o,681279174);V=D(V,Y,X,W,C[P+0],m,3936430074);W=D(W,V,Y,X,C[P+3],l,3572445317);X=D(X,W,V,Y,C[P+6],j,76029189);Y=D(Y,X,W,V,C[P+9],o,3654602809);V=D(V,Y,X,W,C[P+12],m,3873151461);W=D(W,V,Y,X,C[P+15],l,530742520);X=D(X,W,V,Y,C[P+2],j,3299628645);Y=t(Y,X,W,V,C[P+0],U,4096336452);V=t(V,Y,X,W,C[P+7],T,1126891415);W=t(W,V,Y,X,C[P+14],R,2878612391);X=t(X,W,V,Y,C[P+5],O,4237533241);Y=t(Y,X,W,V,C[P+12],U,1700485571);V=t(V,Y,X,W,C[P+3],T,2399980690);W=t(W,V,Y,X,C[P+10],R,4293915773);X=t(X,W,V,Y,C[P+1],O,2240044497);Y=t(Y,X,W,V,C[P+8],U,1873313359);V=t(V,Y,X,W,C[P+15],T,4264355552);W=t(W,V,Y,X,C[P+6],R,2734768916);X=t(X,W,V,Y,C[P+13],O,1309151649);Y=t(Y,X,W,V,C[P+4],U,4149444226);V=t(V,Y,X,W,C[P+11],T,3174756917);W=t(W,V,Y,X,C[P+2],R,718787259);X=t(X,W,V,Y,C[P+9],O,3951481745);Y=K(Y,h);X=K(X,E);W=K(W,v);V=K(V,g);}var i=B(Y)+B(X)+B(W)+B(V);return i.toLowerCase();};

    //JOA properties
    JOA.debug = debug;
    JOA.url = url;
    JOA.header = header;
    //JOA constructor
    JOA.prototype.constructor = JOA;
    //JOA methods
    JOA.headers = headers;
    JOA.addObject = addObject;
    JOA.addZCLReport = addZCLReport;
    JOA.addZCLMultiReport = addZCLMultiReport;
    JOA.addZCLCommand = addZCLCommand;
    JOA.getMessage = getMessage;
    JOA.getMessages = getMessages;
    JOA.clearMessages = clearMessages;
    JOA.removeMessage = removeMessage;
    JOA.toString = toString;
    JOA.toHash = toHash;
    JOA.md5 = md5;
    JOA.post = post;

    return JOA;
}());

// Adds npm support
if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports = module.exports = JOA;
    }
    exports.JOA = JOA;
} else {
    this.JOA = JOA;
}