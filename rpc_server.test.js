import test from 'ava';
import {RpcServer} from './rpc_server'
import sinon from 'sinon';

test.beforeEach(t => {
	t.context.testBackend = {
		sendMessage: sinon.stub(),
		onMessage: sinon.stub(),
		removeMessageListener: sinon.stub()		
	};
	t.context.serverObject = {
		testFunction: sinon.stub(),
		testCallbackRegistrar: sinon.stub(),
		testCallbackDeregistrar: sinon.stub(),
		testCallbackRegistrar2: sinon.stub(),
		testCallbackDeregistrar2: sinon.stub()
	};
	t.context.rpcServer = new RpcServer(t.context.testBackend, t.context.serverObject);
});

test('should register a message listener', t => {
	t.is(t.context.testBackend.onMessage.firstCall.args.length, 1);
});

test('should handle callback registrations.', t => {
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	const args = [
		{
			type: 'string',
			value: 'test'	
		},
		{
			type: 'function',
			id: 'callback-id'
		}
	]
	messageListener({type: 'CALLBACK_REGISTRATION', id: 'test-id', functionName: 'testCallbackRegistrar', args });
	t.is(t.context.serverObject.testCallbackRegistrar.callCount, 1);
	const callbackRegistrationArguments = t.context.serverObject.testCallbackRegistrar.firstCall.args;
	t.is(callbackRegistrationArguments[0], args[0].value);
	const registeredCallback = callbackRegistrationArguments[1];
	t.true(typeof registeredCallback === 'function');
	const callCountBeforeCall = t.context.testBackend.sendMessage.callCount;
	registeredCallback('firstArg', 2);
	t.is(t.context.testBackend.sendMessage.callCount, callCountBeforeCall + 1);
	const callbackMessage = t.context.testBackend.sendMessage.lastCall.args[0];
	t.is(callbackMessage.type, 'CALLBACK');
	t.is(callbackMessage.id, 'callback-id');
	t.deepEqual(callbackMessage.args, ['firstArg', 2]);
});

test('should handle callback deregistrations.', t => {
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	const args = [
		{
			type: 'string',
			value: 'test'	
		},
		{
			type: 'function',
			id: 'callback-id'
		}
	]
	messageListener({type: 'CALLBACK_REGISTRATION', id: 'test-id', functionName: 'testCallbackRegistrar', args });
	t.is(t.context.serverObject.testCallbackRegistrar.callCount, 1);
	const callbackRegistrationArguments = t.context.serverObject.testCallbackRegistrar.firstCall.args;
	t.is(callbackRegistrationArguments[0], args[0].value);
	const registeredCallback = callbackRegistrationArguments[1];
	// Deregistration test
	messageListener({type: 'CALLBACK_DEREGISTRATION', id: 'test-id', functionName: 'testCallbackDeregistrar', args });
	t.is(t.context.serverObject.testCallbackDeregistrar.callCount, 1);
	const callbackDeregistrationArguments = t.context.serverObject.testCallbackDeregistrar.firstCall.args;
	t.is(t.context.serverObject.testCallbackDeregistrar.firstCall.args[1], registeredCallback);
});

test('should handle same callbacks registered multiple times.', t => {
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	const args = [
		{
			type: 'string',
			value: 'test'	
		},
		{
			type: 'function',
			id: 'callback-id'
		}
	]
	messageListener({type: 'CALLBACK_REGISTRATION', id: 'test-id', functionName: 'testCallbackRegistrar', args });
	const registeredCallback = t.context.serverObject.testCallbackRegistrar.firstCall.args[1];
	messageListener({type: 'CALLBACK_REGISTRATION', id: 'test-id', functionName: 'testCallbackRegistrar2', args });
	const registeredCallback1 = t.context.serverObject.testCallbackRegistrar2.firstCall.args[1];
	t.is(registeredCallback, registeredCallback1);


	// Deregistration test
	messageListener({type: 'CALLBACK_DEREGISTRATION', id: 'test-id', functionName: 'testCallbackDeregistrar', args });
	t.is(t.context.serverObject.testCallbackDeregistrar.callCount, 1);
	const deregisteredCallback = t.context.serverObject.testCallbackDeregistrar.firstCall.args[1];
	messageListener({type: 'CALLBACK_DEREGISTRATION', id: 'test-id', functionName: 'testCallbackDeregistrar2', args });
	t.is(t.context.serverObject.testCallbackDeregistrar2.callCount, 1);
	const deregisteredCallback2 = t.context.serverObject.testCallbackDeregistrar2.firstCall.args[1];
	t.is(registeredCallback, deregisteredCallback);
	t.is(deregisteredCallback, deregisteredCallback2);
});

test.only('should handle function calls without return value', t => {
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	messageListener({type: 'FUNCTION_CALL', id: 'test-id', functionName: 'testFunction', args: [
		{type: 'number', value: 1}, {type: 'string', value: 'secondArg' }]});
	t.is(t.context.serverObject.testFunction.callCount, 1);
	t.deepEqual(t.context.serverObject.testFunction.firstCall.args, [1, 'secondArg']);
	t.is(t.context.testBackend.sendMessage.callCount, 1)
	const returnValueMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	t.is(returnValueMessage.id, 'test-id');
	t.is(returnValueMessage.type, 'RETURN_VALUE');
	t.is(returnValueMessage.value, undefined);
});

test('should handle function calls with return value', t => {
	const expectedReturnValue = { prop1: 1, prop2: 'two' };
	t.context.serverObject.testFunction.returns(expectedReturnValue);
	// Emulate function call message
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	messageListener({type: 'FUNCTION_CALL', id: 'test-id', functionName: 'testFunction', args: []});
	t.is(t.context.serverObject.testFunction.callCount, 1);
	const returnValueMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	t.deepEqual(returnValueMessage.value, expectedReturnValue);
});

test('should handle function calls returning a promise.', t => {
	const resolvedValue = 3;
	const returnedPromise = Promise.resolve(resolvedValue);
	t.context.serverObject.testFunction.returns(returnedPromise);
	// Emulate function call message
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	// The return value message will happen asynchronously since testFunction returns a promise, 
	// so we wrap the rest of the test in a promise and let Ava wait for it.
	const result = new Promise((resolve, reject) => {
		t.context.testBackend.sendMessage = (message) => {
			t.is(message.id, 'test-id');
			t.is(message.type, 'RETURN_VALUE');
			t.deepEqual(message.value, resolvedValue);
			resolve();
		};
	});
	messageListener({type: 'FUNCTION_CALL', id: 'test-id', functionName: 'testFunction', args: []});
	return result;
});

test('should handle function call errors', t => {
	t.context.serverObject.testFunction.throws('error object');
	// Emulate function call message
	const messageListener = t.context.testBackend.onMessage.firstCall.args[0];
	messageListener({type: 'FUNCTION_CALL', id: 'test-id', functionName: 'testFunction', args: []});
	t.is(t.context.serverObject.testFunction.callCount, 1);
	const returnValueMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	t.is(returnValueMessage.type, 'ERROR');
	t.not(returnValueMessage.error, undefined);
});